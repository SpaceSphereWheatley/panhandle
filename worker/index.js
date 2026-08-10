// Worker API for shared shopping list + meal planner
// Public origin is whatever domain fronts this Worker (see wrangler.toml's
// APP_ORIGIN var — historically shopping.mohibb.com, now shop.panhandle.app;
// see docs/android-publishing.md). panhandle.app itself serves the marketing
// landing page and a 301 redirect from /app.html to the app's real home
// (see the ROUTING section below). Frontend on Cloudflare Pages. API = this
// Worker under /api/*. Proxies other paths to Pages.
// Auth: users in D1 with PBKDF2 password hashes, JWT with token versioning,
//       sliding expiry, in-app password change that logs out other devices.
// Multi-tenant: every user belongs to exactly one list (users.list_id); all
//       shopping/meal data is scoped by list_id. is_admin/is_owner are
//       independent flags (a user can be both). Admins create owner accounts
//       (each gets its own list); owners add members to their own list.

import { VERSION } from "../shared/version.js";
import { CATEGORIES, normalizeCategoryOrder } from "../shared/categories.js";
import { ERROR_MESSAGES_EN } from "../shared/errorCodes.js";
import { buildPushHTTPRequest } from "@pushforge/builder";

// Deployed Worker (API) version, imported from shared/version.js so it can't
// drift from src/lib/version.js's APP_VERSION. Surfaced at GET /api/version —
// the Profile page shows both so a half-finished deploy (one side stale) is
// visible at a glance.

// Login rate-limiting (TODO #14): max failed attempts per source IP within
// the sliding window below, backed by the login_attempts table (see
// migrations/0001_init.sql, the login_attempts table). Keyed by IP rather than username so a
// flood of failed attempts against one account can't be used to lock out its
// real owner. Also reused by /change-password (see below) to throttle
// current-password brute-forcing on a stolen token.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

// Common Norwegian groceries seeded into a new list's catalogue at creation,
// so a fresh household gets autocomplete/category-matching for everyday items
// instead of a blank catalogue. Categories must be in CATEGORIES.
//
// This array is the single source of truth — editing it and deploying is
// the entire rollout process. New lists get it via createList() immediately;
// existing lists get backfilled automatically within 15 minutes by
// checkCatalogueSync (cron-driven, see scheduled() below), which hashes this
// array on every tick and only re-runs the cross-list backfill when the hash
// has actually changed. There's no separate migration file to write anymore
// (contrast the old one-off migrations/0002_seed_catalogue.sql and
// 0003_expand_catalogue.sql, which hand-transcribed items into SQL and had
// to be run manually — kept only for historical record, not a pattern to
// repeat).
export const COMMON_ITEMS = [
  { name: "Fruit", category: "Fruit and vegetables" },
  { name: "Vegetables", category: "Fruit and vegetables" },
  { name: "Banana", category: "Fruit and vegetables" },
  { name: "Apple", category: "Fruit and vegetables" },
  { name: "Orange", category: "Fruit and vegetables" },
  { name: "Lemon", category: "Fruit and vegetables" },
  { name: "Grapes", category: "Fruit and vegetables" },
  { name: "Strawberries", category: "Fruit and vegetables" },
  { name: "Blueberries", category: "Fruit and vegetables" },
  { name: "Avocado", category: "Fruit and vegetables" },
  { name: "Tomato", category: "Fruit and vegetables" },
  { name: "Cucumber", category: "Fruit and vegetables" },
  { name: "Lettuce", category: "Fruit and vegetables" },
  { name: "Broccoli", category: "Fruit and vegetables" },
  { name: "Carrot", category: "Fruit and vegetables" },
  { name: "Potato", category: "Fruit and vegetables" },
  { name: "Onion", category: "Fruit and vegetables" },
  { name: "Garlic", category: "Fruit and vegetables" },
  { name: "Bell pepper", category: "Fruit and vegetables" },
  { name: "Mushrooms", category: "Fruit and vegetables" },
  { name: "Spinach", category: "Fruit and vegetables" },
  { name: "Ginger", category: "Fruit and vegetables" },
  { name: "Bread", category: "Bread and bakery" },
  { name: "Wholemeal bread", category: "Bread and bakery" },
  { name: "White bread", category: "Bread and bakery" },
  { name: "Bread rolls", category: "Bread and bakery" },
  { name: "Crispbread", category: "Bread and bakery" },
  { name: "Tortilla", category: "Bread and bakery" },
  { name: "Buns", category: "Bread and bakery" },
  { name: "Milk", category: "Dairy" },
  { name: "Low-fat milk", category: "Dairy" },
  { name: "Cream", category: "Dairy" },
  { name: "Sour cream", category: "Dairy" },
  { name: "Butter", category: "Dairy" },
  { name: "Cheese", category: "Dairy" },
  { name: "Brown cheese", category: "Dairy" },
  { name: "White cheese", category: "Dairy" },
  { name: "Norvegia", category: "Dairy" },
  { name: "Mozzarella", category: "Dairy" },
  { name: "Parmesan", category: "Dairy" },
  { name: "Yogurt", category: "Dairy" },
  { name: "Greek yogurt", category: "Dairy" },
  { name: "Skyr", category: "Dairy" },
  { name: "Eggs", category: "Dairy" },
  { name: "Meat", category: "Meat and fish" },
  { name: "Fish", category: "Meat and fish" },
  { name: "Sandwich toppings", category: "Meat and fish" },
  { name: "Ground meat", category: "Meat and fish" },
  { name: "Chicken", category: "Meat and fish" },
  { name: "Chicken fillet", category: "Meat and fish" },
  { name: "Bacon", category: "Meat and fish" },
  { name: "Sausages", category: "Meat and fish" },
  { name: "Meatballs", category: "Meat and fish" },
  { name: "Salmon", category: "Meat and fish" },
  { name: "Cod", category: "Meat and fish" },
  { name: "Tuna", category: "Meat and fish" },
  { name: "Shrimp", category: "Meat and fish" },
  { name: "Fish cakes", category: "Meat and fish" },
  { name: "Cooked ham", category: "Meat and fish" },
  { name: "Flour", category: "Ingredients and spices" },
  { name: "Oil", category: "Ingredients and spices" },
  { name: "Salt", category: "Ingredients and spices" },
  { name: "Pepper", category: "Ingredients and spices" },
  { name: "Sugar", category: "Ingredients and spices" },
  { name: "Wheat flour", category: "Ingredients and spices" },
  { name: "Olive oil", category: "Ingredients and spices" },
  { name: "Soy sauce", category: "Ingredients and spices" },
  { name: "Ketchup", category: "Ingredients and spices" },
  { name: "Mustard", category: "Ingredients and spices" },
  { name: "Mayonnaise", category: "Ingredients and spices" },
  { name: "Tomato paste", category: "Ingredients and spices" },
  { name: "Canned tomatoes", category: "Ingredients and spices" },
  { name: "Honey", category: "Ingredients and spices" },
  { name: "Grandiosa", category: "Frozen and ready meals" },
  { name: "Frozen vegetables", category: "Frozen and ready meals" },
  { name: "Frozen berries", category: "Frozen and ready meals" },
  { name: "French fries", category: "Frozen and ready meals" },
  { name: "Ice cream tub", category: "Frozen and ready meals" },
  { name: "Cereal", category: "Grains and pasta" },
  { name: "Oats", category: "Grains and pasta" },
  { name: "Muesli", category: "Grains and pasta" },
  { name: "Cornflakes", category: "Grains and pasta" },
  { name: "Rice", category: "Grains and pasta" },
  { name: "Pasta", category: "Grains and pasta" },
  { name: "Spaghetti", category: "Grains and pasta" },
  { name: "Macaroni", category: "Grains and pasta" },
  { name: "Couscous", category: "Grains and pasta" },
  { name: "Chickpeas", category: "Grains and pasta" },
  { name: "Potato chips", category: "Snacks and sweets" },
  { name: "Milk chocolate", category: "Snacks and sweets" },
  { name: "Biscuits", category: "Snacks and sweets" },
  { name: "Popcorn", category: "Snacks and sweets" },
  { name: "Chocolate", category: "Snacks and sweets" },
  { name: "Water", category: "Drinks" },
  { name: "Sparkling water", category: "Drinks" },
  { name: "Cola", category: "Drinks" },
  { name: "Juice", category: "Drinks" },
  { name: "Squash", category: "Drinks" },
  { name: "Coffee", category: "Drinks" },
  { name: "Tea", category: "Drinks" },
  { name: "Soda", category: "Drinks" },
  { name: "Apple juice", category: "Drinks" },
  { name: "Toilet paper", category: "Household" },
  { name: "Paper towels", category: "Household" },
  { name: "Kitchen roll", category: "Household" },
  { name: "Dish soap", category: "Household" },
  { name: "Dishwasher tablets", category: "Household" },
  { name: "Laundry detergent", category: "Household" },
  { name: "All-purpose cleaner", category: "Household" },
  { name: "Garbage bags", category: "Household" },
  { name: "Aluminum foil", category: "Household" },
  { name: "Baking paper", category: "Household" },
  { name: "Toothpaste", category: "Health and personal care" },
  { name: "Toothbrush", category: "Health and personal care" },
  { name: "Shampoo", category: "Health and personal care" },
  { name: "Shower gel", category: "Health and personal care" },
  { name: "Hand soap", category: "Health and personal care" },
  { name: "Band-aids", category: "Health and personal care" },
  { name: "Cat food", category: "Pet supplies" },
  { name: "Dog food", category: "Pet supplies" },
  { name: "Flowers", category: "Other" },
  { name: "Pear", category: "Fruit and vegetables" },
  { name: "Clementine", category: "Fruit and vegetables" },
  { name: "Mandarin", category: "Fruit and vegetables" },
  { name: "Lime", category: "Fruit and vegetables" },
  { name: "Grapefruit", category: "Fruit and vegetables" },
  { name: "Raspberries", category: "Fruit and vegetables" },
  { name: "Blackberries", category: "Fruit and vegetables" },
  { name: "Kiwi", category: "Fruit and vegetables" },
  { name: "Mango", category: "Fruit and vegetables" },
  { name: "Pineapple", category: "Fruit and vegetables" },
  { name: "Melon", category: "Fruit and vegetables" },
  { name: "Watermelon", category: "Fruit and vegetables" },
  { name: "Peach", category: "Fruit and vegetables" },
  { name: "Nectarine", category: "Fruit and vegetables" },
  { name: "Plum", category: "Fruit and vegetables" },
  { name: "Apricot", category: "Fruit and vegetables" },
  { name: "Pomegranate", category: "Fruit and vegetables" },
  { name: "Cherry tomatoes", category: "Fruit and vegetables" },
  { name: "Iceberg lettuce", category: "Fruit and vegetables" },
  { name: "Arugula", category: "Fruit and vegetables" },
  { name: "Kale", category: "Fruit and vegetables" },
  { name: "Cauliflower", category: "Fruit and vegetables" },
  { name: "Sweet potato", category: "Fruit and vegetables" },
  { name: "Red onion", category: "Fruit and vegetables" },
  { name: "Leek", category: "Fruit and vegetables" },
  { name: "Spring onion", category: "Fruit and vegetables" },
  { name: "Chili", category: "Fruit and vegetables" },
  { name: "Zucchini", category: "Fruit and vegetables" },
  { name: "Eggplant", category: "Fruit and vegetables" },
  { name: "Corn", category: "Fruit and vegetables" },
  { name: "Sugar snap peas", category: "Fruit and vegetables" },
  { name: "Button mushrooms", category: "Fruit and vegetables" },
  { name: "Radish", category: "Fruit and vegetables" },
  { name: "Beetroot", category: "Fruit and vegetables" },
  { name: "Rutabaga", category: "Fruit and vegetables" },
  { name: "Celery", category: "Fruit and vegetables" },
  { name: "Asparagus", category: "Fruit and vegetables" },
  { name: "Brussels sprouts", category: "Fruit and vegetables" },
  { name: "Cabbage", category: "Fruit and vegetables" },
  { name: "Red cabbage", category: "Fruit and vegetables" },
  { name: "Chinese cabbage", category: "Fruit and vegetables" },
  { name: "Parsley", category: "Fruit and vegetables" },
  { name: "Basil", category: "Fruit and vegetables" },
  { name: "Cilantro", category: "Fruit and vegetables" },
  { name: "Dill", category: "Fruit and vegetables" },
  { name: "Chives", category: "Fruit and vegetables" },
  { name: "Mint", category: "Fruit and vegetables" },
  { name: "Rhubarb", category: "Fruit and vegetables" },
  { name: "Passion fruit", category: "Fruit and vegetables" },
  { name: "Coconut", category: "Fruit and vegetables" },
  { name: "Peas", category: "Fruit and vegetables" },
  { name: "Baguette", category: "Bread and bakery" },
  { name: "Polarbrød", category: "Bread and bakery" },
  { name: "Pita bread", category: "Bread and bakery" },
  { name: "Lefse", category: "Bread and bakery" },
  { name: "Waffles", category: "Bread and bakery" },
  { name: "Pancakes", category: "Bread and bakery" },
  { name: "Croissant", category: "Bread and bakery" },
  { name: "Custard bun", category: "Bread and bakery" },
  { name: "Cinnamon buns", category: "Bread and bakery" },
  { name: "Muffins", category: "Bread and bakery" },
  { name: "Cake", category: "Bread and bakery" },
  { name: "Chocolate cake", category: "Bread and bakery" },
  { name: "Brioche", category: "Bread and bakery" },
  { name: "Sandwich bread", category: "Bread and bakery" },
  { name: "Whole grain bread", category: "Bread and bakery" },
  { name: "Spelt bread", category: "Bread and bakery" },
  { name: "Sourdough bread", category: "Bread and bakery" },
  { name: "Ciabatta", category: "Bread and bakery" },
  { name: "Focaccia", category: "Bread and bakery" },
  { name: "Naan bread", category: "Bread and bakery" },
  { name: "Hamburger buns", category: "Bread and bakery" },
  { name: "Hot dog buns", category: "Bread and bakery" },
  { name: "Rusk", category: "Bread and bakery" },
  { name: "Donut", category: "Bread and bakery" },
  { name: "Whole milk", category: "Dairy" },
  { name: "Skimmed milk", category: "Dairy" },
  { name: "Extra low-fat milk", category: "Dairy" },
  { name: "Lactose-free milk", category: "Dairy" },
  { name: "Whipping cream", category: "Dairy" },
  { name: "Cooking cream", category: "Dairy" },
  { name: "Crème fraîche", category: "Dairy" },
  { name: "Low-fat sour cream", category: "Dairy" },
  { name: "Margarine", category: "Dairy" },
  { name: "Spreadable butter", category: "Dairy" },
  { name: "Jarlsberg", category: "Dairy" },
  { name: "Yellow cheese", category: "Dairy" },
  { name: "Cottage cheese", category: "Dairy" },
  { name: "Cream cheese", category: "Dairy" },
  { name: "Philadelphia", category: "Dairy" },
  { name: "Feta cheese", category: "Dairy" },
  { name: "Cheddar", category: "Dairy" },
  { name: "Plain yogurt", category: "Dairy" },
  { name: "Drinking yogurt", category: "Dairy" },
  { name: "Kefir", category: "Dairy" },
  { name: "Quark", category: "Dairy" },
  { name: "Vanilla custard", category: "Dairy" },
  { name: "Ice cream", category: "Dairy" },
  { name: "Ground beef", category: "Meat and fish" },
  { name: "Pork", category: "Meat and fish" },
  { name: "Beef", category: "Meat and fish" },
  { name: "Chicken thighs", category: "Meat and fish" },
  { name: "Chicken wings", category: "Meat and fish" },
  { name: "Turkey", category: "Meat and fish" },
  { name: "Steak", category: "Meat and fish" },
  { name: "Entrecôte", category: "Meat and fish" },
  { name: "Tenderloin", category: "Meat and fish" },
  { name: "Sirloin", category: "Meat and fish" },
  { name: "Pork chops", category: "Meat and fish" },
  { name: "Pork fillet", category: "Meat and fish" },
  { name: "Grilling sausages", category: "Meat and fish" },
  { name: "Hot dogs", category: "Meat and fish" },
  { name: "Medister patties", category: "Meat and fish" },
  { name: "Lamb", category: "Meat and fish" },
  { name: "Leg of lamb", category: "Meat and fish" },
  { name: "Cured lamb ribs", category: "Meat and fish" },
  { name: "Pork ribs", category: "Meat and fish" },
  { name: "Cured ham", category: "Meat and fish" },
  { name: "Salami", category: "Meat and fish" },
  { name: "Servelat sausage", category: "Meat and fish" },
  { name: "Liver pâté", category: "Meat and fish" },
  { name: "Smoked salmon", category: "Meat and fish" },
  { name: "Trout", category: "Meat and fish" },
  { name: "Pollock", category: "Meat and fish" },
  { name: "Haddock", category: "Meat and fish" },
  { name: "Mackerel", category: "Meat and fish" },
  { name: "Herring", category: "Meat and fish" },
  { name: "Fish balls", category: "Meat and fish" },
  { name: "Fish sticks", category: "Meat and fish" },
  { name: "Fish gratin", category: "Meat and fish" },
  { name: "Crab", category: "Meat and fish" },
  { name: "Mussels", category: "Meat and fish" },
  { name: "Scampi", category: "Meat and fish" },
  { name: "Brown sugar", category: "Ingredients and spices" },
  { name: "Powdered sugar", category: "Ingredients and spices" },
  { name: "Vanilla sugar", category: "Ingredients and spices" },
  { name: "Whole wheat flour", category: "Ingredients and spices" },
  { name: "Cornstarch", category: "Ingredients and spices" },
  { name: "Baking powder", category: "Ingredients and spices" },
  { name: "Baking soda", category: "Ingredients and spices" },
  { name: "Yeast", category: "Ingredients and spices" },
  { name: "Dry yeast", category: "Ingredients and spices" },
  { name: "Rapeseed oil", category: "Ingredients and spices" },
  { name: "Sunflower oil", category: "Ingredients and spices" },
  { name: "Vinegar", category: "Ingredients and spices" },
  { name: "Balsamic vinegar", category: "Ingredients and spices" },
  { name: "Remoulade", category: "Ingredients and spices" },
  { name: "Stock", category: "Ingredients and spices" },
  { name: "Stock cube", category: "Ingredients and spices" },
  { name: "Vegetable stock", category: "Ingredients and spices" },
  { name: "Coconut milk", category: "Ingredients and spices" },
  { name: "Syrup", category: "Ingredients and spices" },
  { name: "Peanut butter", category: "Ingredients and spices" },
  { name: "Chocolate hazelnut spread", category: "Ingredients and spices" },
  { name: "Strawberry jam", category: "Ingredients and spices" },
  { name: "Raspberry jam", category: "Ingredients and spices" },
  { name: "Marmalade", category: "Ingredients and spices" },
  { name: "Curry powder", category: "Ingredients and spices" },
  { name: "Paprika", category: "Ingredients and spices" },
  { name: "Chili powder", category: "Ingredients and spices" },
  { name: "Cinnamon", category: "Ingredients and spices" },
  { name: "Cardamom", category: "Ingredients and spices" },
  { name: "Nutmeg", category: "Ingredients and spices" },
  { name: "Turmeric", category: "Ingredients and spices" },
  { name: "Cumin", category: "Ingredients and spices" },
  { name: "Oregano", category: "Ingredients and spices" },
  { name: "Thyme", category: "Ingredients and spices" },
  { name: "Rosemary", category: "Ingredients and spices" },
  { name: "Bay leaf", category: "Ingredients and spices" },
  { name: "Garlic powder", category: "Ingredients and spices" },
  { name: "Taco seasoning", category: "Ingredients and spices" },
  { name: "BBQ seasoning", category: "Ingredients and spices" },
  { name: "Baking cocoa", category: "Ingredients and spices" },
  { name: "Chocolate chips", category: "Ingredients and spices" },
  { name: "Gelatin", category: "Ingredients and spices" },
  { name: "Vanilla extract", category: "Ingredients and spices" },
  { name: "Almonds", category: "Ingredients and spices" },
  { name: "Walnuts", category: "Ingredients and spices" },
  { name: "Hazelnuts", category: "Ingredients and spices" },
  { name: "Cashews", category: "Ingredients and spices" },
  { name: "Pine nuts", category: "Ingredients and spices" },
  { name: "Raisins", category: "Ingredients and spices" },
  { name: "Sesame seeds", category: "Ingredients and spices" },
  { name: "Sunflower seeds", category: "Ingredients and spices" },
  { name: "Pumpkin seeds", category: "Ingredients and spices" },
  { name: "Stock concentrate", category: "Ingredients and spices" },
  { name: "Frozen pizza", category: "Frozen and ready meals" },
  { name: "Lasagna", category: "Frozen and ready meals" },
  { name: "Frozen peas", category: "Frozen and ready meals" },
  { name: "Potato wedges", category: "Frozen and ready meals" },
  { name: "Onion rings", category: "Frozen and ready meals" },
  { name: "Frozen fish", category: "Frozen and ready meals" },
  { name: "Spring rolls", category: "Frozen and ready meals" },
  { name: "Stir-fry vegetables", category: "Frozen and ready meals" },
  { name: "Frozen meatballs", category: "Frozen and ready meals" },
  { name: "Ready meal", category: "Frozen and ready meals" },
  { name: "Pie", category: "Frozen and ready meals" },
  { name: "Popsicle", category: "Frozen and ready meals" },
  { name: "Frozen chicken", category: "Frozen and ready meals" },
  { name: "Pizza rolls", category: "Frozen and ready meals" },
  { name: "Frozen pancakes", category: "Frozen and ready meals" },
  { name: "Frozen salmon", category: "Frozen and ready meals" },
  { name: "Frozen shrimp", category: "Frozen and ready meals" },
  { name: "Potato lompe", category: "Frozen and ready meals" },
  { name: "Frozen berry smoothie", category: "Frozen and ready meals" },
  { name: "Frozen fish sticks", category: "Frozen and ready meals" },
  { name: "Mini frozen pizza", category: "Frozen and ready meals" },
  { name: "Sausage dough", category: "Frozen and ready meals" },
  { name: "Quick oats", category: "Grains and pasta" },
  { name: "Frosties", category: "Grains and pasta" },
  { name: "Cheerios", category: "Grains and pasta" },
  { name: "Oat flakes cereal", category: "Grains and pasta" },
  { name: "Weetabix", category: "Grains and pasta" },
  { name: "Puffed rice", category: "Grains and pasta" },
  { name: "Jasmine rice", category: "Grains and pasta" },
  { name: "Basmati rice", category: "Grains and pasta" },
  { name: "Rice porridge", category: "Grains and pasta" },
  { name: "Porridge rice", category: "Grains and pasta" },
  { name: "Penne", category: "Grains and pasta" },
  { name: "Fusilli", category: "Grains and pasta" },
  { name: "Lasagna sheets", category: "Grains and pasta" },
  { name: "Tagliatelle", category: "Grains and pasta" },
  { name: "Bulgur", category: "Grains and pasta" },
  { name: "Quinoa", category: "Grains and pasta" },
  { name: "Pearl barley", category: "Grains and pasta" },
  { name: "Red lentils", category: "Grains and pasta" },
  { name: "Black beans", category: "Grains and pasta" },
  { name: "Kidney beans", category: "Grains and pasta" },
  { name: "Polenta", category: "Grains and pasta" },
  { name: "Pancake mix", category: "Grains and pasta" },
  { name: "Waffle mix", category: "Grains and pasta" },
  { name: "Lentils", category: "Grains and pasta" },
  { name: "Cheese puffs", category: "Snacks and sweets" },
  { name: "Pretzel sticks", category: "Snacks and sweets" },
  { name: "Nachos", category: "Snacks and sweets" },
  { name: "Dip", category: "Snacks and sweets" },
  { name: "Salsa", category: "Snacks and sweets" },
  { name: "Guacamole", category: "Snacks and sweets" },
  { name: "Dark chocolate", category: "Snacks and sweets" },
  { name: "Kvikk Lunsj", category: "Snacks and sweets" },
  { name: "Smash", category: "Snacks and sweets" },
  { name: "Non Stop", category: "Snacks and sweets" },
  { name: "Twist", category: "Snacks and sweets" },
  { name: "Gummy candy", category: "Snacks and sweets" },
  { name: "Wine gums", category: "Snacks and sweets" },
  { name: "Licorice", category: "Snacks and sweets" },
  { name: "Pastilles", category: "Snacks and sweets" },
  { name: "Chewing gum", category: "Snacks and sweets" },
  { name: "Digestive biscuits", category: "Snacks and sweets" },
  { name: "Marie biscuits", category: "Snacks and sweets" },
  { name: "Oat biscuits", category: "Snacks and sweets" },
  { name: "Chocolate biscuits", category: "Snacks and sweets" },
  { name: "Snickers", category: "Snacks and sweets" },
  { name: "Kit Kat", category: "Snacks and sweets" },
  { name: "Daim", category: "Snacks and sweets" },
  { name: "Toblerone", category: "Snacks and sweets" },
  { name: "Salty licorice", category: "Snacks and sweets" },
  { name: "Chips", category: "Snacks and sweets" },
  { name: "Mineral water", category: "Drinks" },
  { name: "Coke Zero", category: "Drinks" },
  { name: "Sprite", category: "Drinks" },
  { name: "Fanta", category: "Drinks" },
  { name: "Solo", category: "Drinks" },
  { name: "Urge", category: "Drinks" },
  { name: "Pepsi", category: "Drinks" },
  { name: "Orange juice", category: "Drinks" },
  { name: "Multivitamin juice", category: "Drinks" },
  { name: "Blackcurrant squash", category: "Drinks" },
  { name: "Apple must", category: "Drinks" },
  { name: "Iced tea", category: "Drinks" },
  { name: "Filter coffee", category: "Drinks" },
  { name: "Coffee capsules", category: "Drinks" },
  { name: "Espresso", category: "Drinks" },
  { name: "Green tea", category: "Drinks" },
  { name: "Black tea", category: "Drinks" },
  { name: "Herbal tea", category: "Drinks" },
  { name: "Cocoa powder", category: "Drinks" },
  { name: "Energy drink", category: "Drinks" },
  { name: "Red Bull", category: "Drinks" },
  { name: "Smoothie", category: "Drinks" },
  { name: "Beer", category: "Drinks" },
  { name: "Wine", category: "Drinks" },
  { name: "Napkins", category: "Household" },
  { name: "Dishwasher salt", category: "Household" },
  { name: "Fabric softener", category: "Household" },
  { name: "Stain remover", category: "Household" },
  { name: "Bleach", category: "Household" },
  { name: "Glass cleaner", category: "Household" },
  { name: "Toilet cleaner", category: "Household" },
  { name: "Bathroom cleaner", category: "Household" },
  { name: "Scouring powder", category: "Household" },
  { name: "Dish brush", category: "Household" },
  { name: "Dish sponge", category: "Household" },
  { name: "Cloths", category: "Household" },
  { name: "Microfiber cloth", category: "Household" },
  { name: "Trash bags", category: "Household" },
  { name: "Freezer bags", category: "Household" },
  { name: "Wax paper", category: "Household" },
  { name: "Plastic wrap", category: "Household" },
  { name: "Light bulb", category: "Household" },
  { name: "Batteries", category: "Household" },
  { name: "Candles", category: "Household" },
  { name: "Tea lights", category: "Household" },
  { name: "Matches", category: "Household" },
  { name: "Floor mop", category: "Household" },
  { name: "Air freshener", category: "Household" },
  { name: "Laundry powder", category: "Household" },
  { name: "Fabric conditioner", category: "Household" },
  { name: "Soft soap", category: "Household" },
  { name: "Toothpicks", category: "Household" },
  { name: "Tape", category: "Household" },
  { name: "Clothespins", category: "Household" },
  { name: "Zip bags", category: "Household" },
  { name: "Kitchen hand soap", category: "Household" },
  { name: "Dusting cloths", category: "Household" },
  { name: "Washcloth", category: "Household" },
  { name: "Diapers", category: "Health and personal care" },
  { name: "Diapers size 4", category: "Health and personal care" },
  { name: "Diapers size 5", category: "Health and personal care" },
  { name: "Wet wipes", category: "Health and personal care" },
  { name: "Baby food", category: "Health and personal care" },
  { name: "Baby porridge", category: "Health and personal care" },
  { name: "Baby formula porridge", category: "Health and personal care" },
  { name: "Infant formula", category: "Health and personal care" },
  { name: "Pacifier", category: "Health and personal care" },
  { name: "Baby bottle", category: "Health and personal care" },
  { name: "Diaper bags", category: "Health and personal care" },
  { name: "Baby oil", category: "Health and personal care" },
  { name: "Baby cream", category: "Health and personal care" },
  { name: "Vaseline", category: "Health and personal care" },
  { name: "Sunscreen", category: "Health and personal care" },
  { name: "Sunscreen for kids", category: "Health and personal care" },
  { name: "Mosquito spray", category: "Health and personal care" },
  { name: "Bandages", category: "Health and personal care" },
  { name: "Wound ointment", category: "Health and personal care" },
  { name: "Hand sanitizer", category: "Health and personal care" },
  { name: "Face mask", category: "Health and personal care" },
  { name: "Paracetamol", category: "Health and personal care" },
  { name: "Ibuprofen", category: "Health and personal care" },
  { name: "Paracetamol for kids", category: "Health and personal care" },
  { name: "Nasal spray", category: "Health and personal care" },
  { name: "Throat lozenges", category: "Health and personal care" },
  { name: "Cough syrup", category: "Health and personal care" },
  { name: "Thermometer", category: "Health and personal care" },
  { name: "Cotton swabs", category: "Health and personal care" },
  { name: "Toothbrush for kids", category: "Health and personal care" },
  { name: "Toothpaste for kids", category: "Health and personal care" },
  { name: "Dental floss", category: "Health and personal care" },
  { name: "Mouthwash", category: "Health and personal care" },
  { name: "Shampoo for kids", category: "Health and personal care" },
  { name: "Conditioner", category: "Health and personal care" },
  { name: "Deodorant", category: "Health and personal care" },
  { name: "Shaving foam", category: "Health and personal care" },
  { name: "Razor blades", category: "Health and personal care" },
  { name: "Sanitary pads", category: "Health and personal care" },
  { name: "Tampons", category: "Health and personal care" },
  { name: "Panty liners", category: "Health and personal care" },
  { name: "Moisturizer", category: "Health and personal care" },
  { name: "Q-tips", category: "Health and personal care" },
  { name: "Vitamins", category: "Health and personal care" },
  { name: "Cod liver oil", category: "Health and personal care" },
  { name: "Multivitamin for kids", category: "Health and personal care" },
  { name: "Wet cat food", category: "Pet supplies" },
  { name: "Dry cat food", category: "Pet supplies" },
  { name: "Cat litter", category: "Pet supplies" },
  { name: "Cat treats", category: "Pet supplies" },
  { name: "Wet dog food", category: "Pet supplies" },
  { name: "Dry dog food", category: "Pet supplies" },
  { name: "Dog treats", category: "Pet supplies" },
  { name: "Chew bone", category: "Pet supplies" },
  { name: "Bird seed", category: "Pet supplies" },
  { name: "Fish food", category: "Pet supplies" },
  { name: "Rabbit food", category: "Pet supplies" },
  { name: "Pet toys", category: "Pet supplies" },
  { name: "Dog poop bags", category: "Pet supplies" },
  { name: "Gift wrap", category: "Other" },
  { name: "Gift ribbon", category: "Other" },
  { name: "Birthday candles", category: "Other" },
  { name: "Balloons", category: "Other" },
  { name: "Party napkins", category: "Other" },
  { name: "Disposable cutlery", category: "Other" },
  { name: "Disposable plates", category: "Other" },
  { name: "Plastic cups", category: "Other" },
  { name: "Straws", category: "Other" },
  { name: "Charcoal", category: "Other" },
  { name: "Lighter fluid", category: "Other" },
  { name: "Potted plant", category: "Other" },
  { name: "Soil", category: "Other" },
  { name: "Seeds", category: "Other" },
  { name: "Cherries", category: "Fruit and vegetables" },
  { name: "Sweet cherries", category: "Fruit and vegetables" },
  { name: "Gooseberries", category: "Fruit and vegetables" },
  { name: "Cranberries", category: "Fruit and vegetables" },
  { name: "Figs", category: "Fruit and vegetables" },
  { name: "Dates", category: "Fruit and vegetables" },
  { name: "Lychee", category: "Fruit and vegetables" },
  { name: "Papaya", category: "Fruit and vegetables" },
  { name: "Ground cherries", category: "Fruit and vegetables" },
  { name: "Mirabelle plum", category: "Fruit and vegetables" },
  { name: "Persimmon", category: "Fruit and vegetables" },
  { name: "Fennel", category: "Fruit and vegetables" },
  { name: "Artichoke", category: "Fruit and vegetables" },
  { name: "Bok choy", category: "Fruit and vegetables" },
  { name: "Chard", category: "Fruit and vegetables" },
  { name: "Frisée lettuce", category: "Fruit and vegetables" },
  { name: "Romaine lettuce", category: "Fruit and vegetables" },
  { name: "Spring mix salad", category: "Fruit and vegetables" },
  { name: "Celeriac", category: "Fruit and vegetables" },
  { name: "Turnip", category: "Fruit and vegetables" },
  { name: "Tarragon", category: "Fruit and vegetables" },
  { name: "Sage", category: "Fruit and vegetables" },
  { name: "Cress", category: "Fruit and vegetables" },
  { name: "Shallot", category: "Fruit and vegetables" },
  { name: "Rye bread", category: "Bread and bakery" },
  { name: "Flatbread", category: "Bread and bakery" },
  { name: "Potato lompe flatbread", category: "Bread and bakery" },
  { name: "Grissini", category: "Bread and bakery" },
  { name: "Bagel", category: "Bread and bakery" },
  { name: "Muesli bread", category: "Bread and bakery" },
  { name: "Sunflower bread", category: "Bread and bakery" },
  { name: "Stone-baked bread", category: "Bread and bakery" },
  { name: "Low-carb bread", category: "Bread and bakery" },
  { name: "Gluten-free bread", category: "Bread and bakery" },
  { name: "Danish pastry", category: "Bread and bakery" },
  { name: "Mascarpone", category: "Dairy" },
  { name: "Ricotta", category: "Dairy" },
  { name: "Halloumi", category: "Dairy" },
  { name: "Goat cheese", category: "Dairy" },
  { name: "Pultost", category: "Dairy" },
  { name: "Oat milk", category: "Dairy" },
  { name: "Almond milk", category: "Dairy" },
  { name: "Soy milk", category: "Dairy" },
  { name: "Vegan cheese", category: "Dairy" },
  { name: "Vegan yogurt", category: "Dairy" },
  { name: "Vegan sour cream", category: "Dairy" },
  { name: "Veal", category: "Meat and fish" },
  { name: "Moose meat", category: "Meat and fish" },
  { name: "Reindeer meat", category: "Meat and fish" },
  { name: "Duck breast", category: "Meat and fish" },
  { name: "Rabbit", category: "Meat and fish" },
  { name: "Goat meat", category: "Meat and fish" },
  { name: "Lamb chops", category: "Meat and fish" },
  { name: "Chorizo", category: "Meat and fish" },
  { name: "Pepperoni", category: "Meat and fish" },
  { name: "Prosciutto", category: "Meat and fish" },
  { name: "Parma ham", category: "Meat and fish" },
  { name: "Chicken cold cuts", category: "Meat and fish" },
  { name: "Turkey cold cuts", category: "Meat and fish" },
  { name: "Mackerel in tomato sauce", category: "Meat and fish" },
  { name: "Anchovies", category: "Meat and fish" },
  { name: "Caviar", category: "Meat and fish" },
  { name: "Crab claws", category: "Meat and fish" },
  { name: "Lobster", category: "Meat and fish" },
  { name: "Oysters", category: "Meat and fish" },
  { name: "Pangasius", category: "Meat and fish" },
  { name: "Wolffish", category: "Meat and fish" },
  { name: "Monkfish", category: "Meat and fish" },
  { name: "Tofu", category: "Meat and fish" },
  { name: "Tempeh", category: "Meat and fish" },
  { name: "Vegan ground meat", category: "Meat and fish" },
  { name: "Falafel", category: "Meat and fish" },
  { name: "Cayenne pepper", category: "Ingredients and spices" },
  { name: "Chili flakes", category: "Ingredients and spices" },
  { name: "Sambal Oelek", category: "Ingredients and spices" },
  { name: "Sweet chili sauce", category: "Ingredients and spices" },
  { name: "BBQ sauce", category: "Ingredients and spices" },
  { name: "Pesto", category: "Ingredients and spices" },
  { name: "Worcestershire sauce", category: "Ingredients and spices" },
  { name: "Fish sauce", category: "Ingredients and spices" },
  { name: "Oyster sauce", category: "Ingredients and spices" },
  { name: "Hoisin sauce", category: "Ingredients and spices" },
  { name: "Sriracha", category: "Ingredients and spices" },
  { name: "Tabasco", category: "Ingredients and spices" },
  { name: "Vanilla pod", category: "Ingredients and spices" },
  { name: "Saffron", category: "Ingredients and spices" },
  { name: "Anise", category: "Ingredients and spices" },
  { name: "Fennel seeds", category: "Ingredients and spices" },
  { name: "Coriander seeds", category: "Ingredients and spices" },
  { name: "Mustard seeds", category: "Ingredients and spices" },
  { name: "Caraway seeds", category: "Ingredients and spices" },
  { name: "Star anise", category: "Ingredients and spices" },
  { name: "Cloves", category: "Ingredients and spices" },
  { name: "White pepper", category: "Ingredients and spices" },
  { name: "Red wine vinegar", category: "Ingredients and spices" },
  { name: "White wine vinegar", category: "Ingredients and spices" },
  { name: "Coconut oil", category: "Ingredients and spices" },
  { name: "Sesame oil", category: "Ingredients and spices" },
  { name: "Agave syrup", category: "Ingredients and spices" },
  { name: "Maple syrup", category: "Ingredients and spices" },
  { name: "Stevia", category: "Ingredients and spices" },
  { name: "Almond flour", category: "Ingredients and spices" },
  { name: "Coconut flour", category: "Ingredients and spices" },
  { name: "Hemp seeds", category: "Ingredients and spices" },
  { name: "Chia seeds", category: "Ingredients and spices" },
  { name: "Flaxseed", category: "Ingredients and spices" },
  { name: "Peanuts", category: "Ingredients and spices" },
  { name: "Pistachios", category: "Ingredients and spices" },
  { name: "Macadamia nuts", category: "Ingredients and spices" },
  { name: "Dried apricots", category: "Ingredients and spices" },
  { name: "Dried figs", category: "Ingredients and spices" },
  { name: "Dried dates", category: "Ingredients and spices" },
  { name: "Dried cranberries", category: "Ingredients and spices" },
  { name: "Ice cream bar", category: "Frozen and ready meals" },
  { name: "Soft serve ice cream", category: "Frozen and ready meals" },
  { name: "Frozen beans", category: "Frozen and ready meals" },
  { name: "Frozen cauliflower", category: "Frozen and ready meals" },
  { name: "Frozen broccoli", category: "Frozen and ready meals" },
  { name: "Ice cream cake", category: "Frozen and ready meals" },
  { name: "Frozen croissants", category: "Frozen and ready meals" },
  { name: "Frozen mango", category: "Frozen and ready meals" },
  { name: "Oat flour", category: "Grains and pasta" },
  { name: "Barley", category: "Grains and pasta" },
  { name: "Spelt", category: "Grains and pasta" },
  { name: "Rye", category: "Grains and pasta" },
  { name: "Muesli bars", category: "Grains and pasta" },
  { name: "Soybeans", category: "Grains and pasta" },
  { name: "Edamame", category: "Grains and pasta" },
  { name: "Millet", category: "Grains and pasta" },
  { name: "Rice noodles", category: "Grains and pasta" },
  { name: "Egg noodles", category: "Grains and pasta" },
  { name: "Glass noodles", category: "Grains and pasta" },
  { name: "Udon noodles", category: "Grains and pasta" },
  { name: "Ramen", category: "Grains and pasta" },
  { name: "Twix", category: "Snacks and sweets" },
  { name: "Mars", category: "Snacks and sweets" },
  { name: "Bounty", category: "Snacks and sweets" },
  { name: "Maltesers", category: "Snacks and sweets" },
  { name: "Marshmallow candy", category: "Snacks and sweets" },
  { name: "Marshmallows", category: "Snacks and sweets" },
  { name: "Licorice roll", category: "Snacks and sweets" },
  { name: "Pick and mix candy", category: "Snacks and sweets" },
  { name: "Protein bar", category: "Snacks and sweets" },
  { name: "Sports drink", category: "Drinks" },
  { name: "Kombucha", category: "Drinks" },
  { name: "Iced coffee", category: "Drinks" },
  { name: "Fruit must", category: "Drinks" },
  { name: "Grape juice", category: "Drinks" },
  { name: "Cranberry juice", category: "Drinks" },
  { name: "Pineapple juice", category: "Drinks" },
  { name: "Mango juice", category: "Drinks" },
  { name: "Cider", category: "Drinks" },
  { name: "Non-alcoholic beer", category: "Drinks" },
  { name: "Lunch box", category: "Household" },
  { name: "Thermos", category: "Household" },
  { name: "Water bottle", category: "Household" },
  { name: "Descaler", category: "Household" },
  { name: "Delicate wash detergent", category: "Household" },
  { name: "Silicone mold", category: "Household" },
  { name: "Baking pan", category: "Household" },
  { name: "Disposable gloves", category: "Household" },
  { name: "Rubber gloves", category: "Household" },
  { name: "Broom", category: "Household" },
  { name: "Dustpan", category: "Household" },
  { name: "Window squeegee", category: "Household" },
  { name: "Toilet brush", category: "Household" },
  { name: "Moth repellent", category: "Household" },
  { name: "Insect spray", category: "Household" },
  { name: "Fuses", category: "Household" },
  { name: "Extension cord", category: "Household" },
  { name: "Vitamin D", category: "Health and personal care" },
  { name: "Magnesium", category: "Health and personal care" },
  { name: "Probiotics", category: "Health and personal care" },
  { name: "Iron supplement", category: "Health and personal care" },
  { name: "Allergy tablets", category: "Health and personal care" },
  { name: "Eye drops", category: "Health and personal care" },
  { name: "Nose drops", category: "Health and personal care" },
  { name: "Compresses", category: "Health and personal care" },
  { name: "Sports tape", category: "Health and personal care" },
  { name: "Cold pack", category: "Health and personal care" },
  { name: "Heating pad", category: "Health and personal care" },
  { name: "Pregnancy test", category: "Health and personal care" },
  { name: "Condoms", category: "Health and personal care" },
  { name: "Menstrual cup", category: "Health and personal care" },
  { name: "Intimate wash", category: "Health and personal care" },
  { name: "Shaving cream", category: "Health and personal care" },
  { name: "Hair removal cream", category: "Health and personal care" },
  { name: "Hairspray", category: "Health and personal care" },
  { name: "Hair gel", category: "Health and personal care" },
  { name: "Lip balm", category: "Health and personal care" },
  { name: "Nail clippers", category: "Health and personal care" },
  { name: "Tweezers", category: "Health and personal care" },
  { name: "Hamster food", category: "Pet supplies" },
  { name: "Guinea pig food", category: "Pet supplies" },
  { name: "Glue", category: "Other" },
  { name: "Scissors", category: "Other" },
  { name: "Pen", category: "Other" },
  { name: "Notebook", category: "Other" },
  { name: "Envelopes", category: "Other" },
  { name: "Fertilizer", category: "Other" }
];

// Creates a new list, seeded with COMMON_ITEMS. Shared by /admin/owners,
// /register, and /auth/google so "what a brand-new list looks like" only
// exists in one place. `name` is an optional household display name
// (lists.name); omitted/undefined for the admin-driven paths, which don't
// collect one.
async function createList(env, name) {
  const list = await env.DB.prepare(
    "INSERT INTO lists (name) VALUES (?1) RETURNING id"
  ).bind(name || null).first();
  const listId = list.id;
  await env.DB.batch(COMMON_ITEMS.map(it =>
    env.DB.prepare("INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3)")
      .bind(it.name, it.category, listId)
  ));
  return listId;
}

// ---------- JWT helpers (HS256, no external deps) ----------
export function b64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Encode via UTF-8 bytes so payloads with non-ASCII characters (e.g. a
// username with æ/ø/å) don't make btoa throw.
export function b64urlStr(str) {
  return b64url(new TextEncoder().encode(str));
}
export function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
// Constant-time string comparison so a JWT signature check can't be probed
// byte-by-byte via response timing.
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
export async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}
export async function signJwt(payload, secret) {
  const header = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlStr(JSON.stringify(payload));
  const sig = await hmac(secret, `${header}.${body}`);
  return `${header}.${body}.${sig}`;
}
export async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = await hmac(secret, `${header}.${body}`);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ---------- password hashing (PBKDF2 via Web Crypto) ----------
const PBKDF2_ITER = 100000;
// A well-formed but unmatchable hash. Verified against this when the supplied
// username doesn't exist, so login spends the same PBKDF2 time either way and
// can't be used to enumerate valid usernames by response latency.
const DUMMY_PASS_HASH =
  "100000:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export async function hashPassword(password, saltBytes) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    keyMaterial, 256
  );
  const hashB64 = b64url(bits);
  const saltB64 = b64url(salt.buffer);
  return `${PBKDF2_ITER}:${saltB64}:${hashB64}`;
}
export async function verifyPassword(password, stored) {
  try {
    const [iterStr, saltB64, hashB64] = stored.split(":");
    const iterations = parseInt(iterStr, 10);
    const salt = Uint8Array.from(atob(saltB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial, 256
    );
    return b64url(bits) === hashB64;
  } catch { return false; }
}

// Generates a short, human-readable random password for admin/owner-created
// accounts. Charset omits visually ambiguous characters (0/O, 1/l/I) since
// these are read off a screen and retyped by hand. ~12 chars, grouped
// xxxx-xxxx-xxxx. Rejection sampling avoids modulo bias. No external deps.
export function genPassword() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const len = 12;
  const max = Math.floor(256 / charset.length) * charset.length;
  const out = [];
  while (out.length < len) {
    const buf = crypto.getRandomValues(new Uint8Array(len));
    for (const b of buf) {
      if (b < max) out.push(charset[b % charset.length]);
      if (out.length === len) break;
    }
  }
  return out.join("").replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
}

// Cheap format check shared by /register and /change-email — not RFC-strict,
// just enough to reject obvious garbage before it hits the DB/Resend.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

// Cleans a free-typed display name (Settings, signup, admin/owner creation):
// trims, collapses internal whitespace, caps length. Unlike capitalizeName
// (catalogue items), a person's name isn't force-capitalized — nicknames/
// casing like "iPhone-Ola" should survive as typed. Returns "" if blank.
export function sanitizeDisplayName(name) {
  return (name || "").trim().replace(/\s+/g, " ").slice(0, 60);
}

// ---------- free-text input limits ----------
// Every free-typed field that reaches the DB gets a length cap from here.
// Before this existed, caps were applied wherever someone happened to think
// of one — display names (60), feedback (4000) and recipe import (60x200)
// had them, while item names, notes, meal names, ingredient/label arrays and
// every storage-box field had none at all, so a single request could store an
// arbitrarily large string (or, for the JSON-encoded arrays, arbitrarily many
// of them). Keeping the numbers in one table is the point: a new free-text
// field should pick its cap from here rather than inventing one inline.
//
// The values are deliberately generous — far above any legitimate entry — so
// they act as an abuse ceiling, not a UX constraint. Nothing the app's own UI
// can produce comes close to them.
export const TEXT_LIMITS = {
  itemName: 100,
  itemNotes: 500,
  mealName: 120,
  mealIngredient: 200,
  mealIngredients: 60, // array length; matches MAX_RECIPE_INGREDIENTS
  mealLabel: 40,
  mealLabels: 20, // array length
  responsible: 60, // free text, but a person's name — same cap as display names
  listName: 60,
  boxName: 120,
  boxLocation: 120,
  boxNotes: 2000,
  boxItem: 200,
  boxItems: 200, // array length
};

// True when a free-typed string exceeds its cap. Callers reject with
// TEXT_TOO_LONG rather than truncating: silently storing a cut-off item name
// is worse than refusing it, since the user has no way to tell what was
// actually saved. (sanitizeDisplayName predates this and still truncates —
// left as-is, since a 60-char cap on a display name is a UI-shaped limit
// rather than an abuse ceiling, and rejecting there would be a behaviour
// change on an endpoint nothing complained about.)
export function textTooLong(value, max) {
  return typeof value === "string" && value.trim().length > max;
}

// Normalises a free-typed string array (meal ingredients, storage-box
// contents) for JSON-encoded storage: coerces each entry to a trimmed string
// and drops blanks. Returns null — a rejection, surfaced as TOO_MANY_ENTRIES
// or TEXT_TOO_LONG by the caller — when the array is longer than `maxLen` or
// any entry exceeds `maxItemLen`. The coercion matters as much as the caps:
// these arrays were previously JSON.stringify'd straight from the request
// body, so a client could store arbitrary nested objects in a column the rest
// of the app reads back as an array of strings.
//
// The array cap counts the *kept* entries, after blanks are dropped — not the
// raw array — so a client sending a few trailing empty rows (which the
// editors do) isn't rejected over entries that were never going to be stored.
export function sanitizeStringArray(value, { maxLen, maxItemLen }) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value) {
    const s = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
    if (!s) continue;
    if (s.length > maxItemLen) return null;
    out.push(s);
  }
  return out.length > maxLen ? null : out;
}

// Recognises a gluten-free marker (GF / gf / glutenfri / glutenfritt) typed as
// part of an item name and reports it so the caller can lift it into the notes:
// "Pasta GF" becomes name "Pasta" + note "GF". The cleaned name still resolves
// to the normal catalogue entry, so a plain "Pasta" and a "Pasta" + "GF" note
// share the same catalogue row but stay distinct list lines (the add path's
// merge check is notes-aware). If the marker is the entire input (e.g. just
// "GF"), it's left untouched — there's no item name to attach it to.
export function extractGlutenFree(name) {
  let gf = false;
  const cleaned = (name || "")
    .replace(/\b(gf|glutenfri|glutenfritt)\b/gi, () => { gf = true; return " "; })
    .replace(/\s+/g, " ")
    .trim();
  if (!gf || !cleaned) return { name: (name || "").trim(), gf: false };
  return { name: cleaned, gf: true };
}

// Upper-cases the first character of an item/catalogue name so stored names are
// always capitalised ("brød" -> "Brød"), leaving the rest as typed (proper
// nouns, acronyms and casing like "7 Up" survive). Applied wherever a catalogue
// name is created or renamed; the frontend mirrors it at display time.
export function capitalizeName(name) {
  const s = (name || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Cleans a free-form labels array for storage on meal_catalogue: trims each,
// drops blanks, capitalises like capitalizeName, and dedupes case-insensitively
// (keeping the first-seen casing) so "vegetar" and "Vegetar" don't both stick.
// Returns null when the array is longer than TEXT_LIMITS.mealLabels or any
// label exceeds TEXT_LIMITS.mealLabel, so the caller can reject rather than
// store an unbounded list (see TEXT_LIMITS above). Non-string entries are
// still dropped rather than rejected — that predates the caps and callers
// rely on it.
export function sanitizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  if (labels.length > TEXT_LIMITS.mealLabels) return null;
  const seen = new Set();
  const out = [];
  for (const raw of labels) {
    const clean = capitalizeName(typeof raw === "string" ? raw : "");
    if (!clean) continue;
    if (clean.length > TEXT_LIMITS.mealLabel) return null;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

// ---------- recipe import (paste a URL -> meal name + ingredients) ----------
const MAX_RECIPE_INGREDIENTS = 60;
const MAX_RECIPE_INGREDIENT_LEN = 200;
const MAX_RECIPE_NAME_LEN = 200;
const RECIPE_FETCH_CAP_BYTES = 3_000_000; // ~3MB; Content-Length can't be trusted alone

// Reads a ReadableStream up to `capBytes`, decoding as UTF-8 text. Recipe
// JSON-LD is almost always in <head>/early <body>, well before any multi-MB
// page would be cut off, so a truncated read still reaches the parser intact.
async function readCapped(stream, capBytes) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0, text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (total >= capBytes) { reader.cancel(); break; }
  }
  return text;
}

function findRecipeNode(node) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) return node;
  if (node["@graph"]) return findRecipeNode(node["@graph"]);
  return null;
}

function cleanRecipeNode(node) {
  const rawName = Array.isArray(node.name) ? node.name[0] : node.name;
  const name = typeof rawName === "string" ? rawName.trim().slice(0, MAX_RECIPE_NAME_LEN) : "";
  const rawIngredients = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient
    : Array.isArray(node.ingredients) ? node.ingredients : [];
  const ingredients = rawIngredients
    .filter((i) => typeof i === "string" && i.trim())
    .map((i) => i.trim().slice(0, MAX_RECIPE_INGREDIENT_LEN))
    .slice(0, MAX_RECIPE_INGREDIENTS);
  if (!name || !ingredients.length) return null;
  return { name, ingredients };
}

// Extracts { name, ingredients } from a page's schema.org Recipe JSON-LD, or
// null if none found/usable. Deliberately shallow: a top-level array of
// <script> blocks plus one level of @graph unwrapping covers the large
// majority of real recipe sites without a general JSON-LD graph walker.
export function parseRecipeFromHtml(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of scripts) {
    let data;
    try { data = JSON.parse(raw.trim()); } catch { continue; }
    const node = findRecipeNode(data);
    if (!node) continue;
    const cleaned = cleanRecipeNode(node);
    if (cleaned) return cleaned;
  }
  return null;
}

// ---------- push notification helpers (TODO #7 phases 1-2) ----------
// HH:mm, minutes restricted to 15-minute increments to match the cron's
// check granularity (see runReminderPass below) — any other value would
// simply never fire.
const REMINDER_TIME_RE = /^([01]\d|2[0-3]):(00|15|30|45)$/;

// Bounds for the shopping list's stale-item marker threshold (days) — not a
// push reminder, just a sanity range for the client-side visual indicator.
const STALE_ITEM_DAYS_MIN = 1;
const STALE_ITEM_DAYS_MAX = 90;

// Computes the current Europe/Oslo local wall-clock time plus "today"/
// "tomorrow" calendar dates from a UTC timestamp, via Intl's IANA tz
// database rather than manual UTC-offset math — this correctly follows
// Oslo's CET/CEST DST transitions. Two known, accepted edge cases (not
// fixed here): a reminder time that falls in the skipped local hour on the
// spring-forward day silently doesn't fire that one day/year, and the
// repeated local hour on the fall-back day makes two different UTC cron
// ticks resolve to the same hhmm/target date — notification_log's
// UNIQUE(list_id, type, target_date) constraint absorbs that as a no-op
// second attempt rather than a double-send.
export function osloLocalDateParts(nowMs) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(nowMs).map((x) => [x.type, x.value]));
  const today = `${p.year}-${p.month}-${p.day}`;
  const todayUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  // Built from the local calendar date (not nowMs directly) so "+1 day"
  // can't be thrown off by the local UTC offset near midnight.
  const tomorrow = new Date(todayUtc + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // 0=Mon..6=Sun, matching recurring_schedule.day_of_week's convention
  // (JS's own getUTCDay() is 0=Sun..6=Sat, so shift it by one).
  const dow = (new Date(todayUtc).getUTCDay() + 6) % 7;
  return { hhmm: `${p.hour}:${p.minute}`, today, tomorrow, dow };
}

// Both sides are plain HH:mm strings — callers ensure configuredTime is
// already validated/normalized at the notification-settings endpoint.
export function isReminderDue(hhmm, configuredTime) {
  return hhmm === configuredTime;
}

// Adds `days` (may be negative) to a YYYY-MM-DD string, returning a new
// YYYY-MM-DD string — used to compute the Sunday-end of the week that
// starts on a given Monday (see checkWeeklyReminders).
export function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ---------- response helpers ----------
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", ...extra }
  });

// Every error response carries a stable `code` alongside the human-readable
// `error` string. The string stays exactly what it always was (canonical
// Norwegian, from shared/errorCodes.js) so any client reading only `error`
// is unaffected; the code is what a translating client maps to its own
// wording. `detail` appends context to the message for the few errors that
// carry a runtime value (e.g. a DB message) — never part of the code.
const err = (code, status = 400, { detail = null, extra = {} } = {}) => {
  const message = ERROR_MESSAGES_EN[code];
  return json({ error: detail ? `${message}: ${detail}` : message, code }, status, extra);
};

// ---------- security headers on the proxied app shell ----------
// Everything that isn't /api/* is proxied straight from the Pages project,
// and used to be returned byte-for-byte with whatever headers Pages set —
// meaning no clickjacking, MIME-sniffing or referrer protection anywhere on
// the app. The Worker already sits in front of every request, so this is the
// one place to add them.
//
// The Content-Security-Policy is deliberately **Report-Only** for now. A
// wrong policy fails client-side and silently (nothing reaches the Worker
// log), on an app where a merge to main is live within a minute — so it ships
// observing first, and flips to the enforcing `Content-Security-Policy`
// header in a later release once a deploy-preview click-through shows a clean
// console. The allowances below are what the app actually loads today:
//   - 'unsafe-inline' script: app.html's theme/intensity bootstrap and
//     public/index.html + changelog.html's inline blocks (public/ has no build
//     step, so those can't be hashed at build time).
//   - accounts.google.com: Sign in with Google (script + its iframe).
//   - challenges.cloudflare.com: Turnstile (script + its iframe).
//   - fonts.googleapis.com/fonts.gstatic.com: the webfonts app.html links.
//   - unpkg.com: public/index.html's Phosphor icon stylesheets (the marketing
//     page only — the app itself bundles them).
//   - blob:/data: images: QR rendering and the in-app camera scanner.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://accounts.google.com",
  "frame-src https://accounts.google.com https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  // Enforced: all three are inert for an app that never intends to be framed,
  // never relies on MIME sniffing, and has no cross-origin referrer need.
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Camera is the one powerful feature the app uses (QrScanModal); everything
  // else is denied outright.
  headers.set("Permissions-Policy", "camera=(self), geolocation=(), microphone=(), payment=()");
  headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Parses a JSON request body, returning null on empty/malformed input so
// callers can answer 400 instead of throwing an opaque 500.
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Verifies JWT signature/expiry AND that token_version matches the DB. Returns
// the live user row (flags + list_id) — the DB is the source of truth on every
// request, so any change to a user's flags/list_id/token_version takes effect
// on their next call (the JWT's copies are only client-display hints).
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return null;
  const row = await env.DB.prepare(
    "SELECT username, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
  ).bind(payload.sub).first();
  if (!row) return null;
  if (payload.tv !== row.token_version) return null;
  return row;
}

// Mints a 90-day token from a user row. list_id/is_admin/is_owner are carried
// for the client's convenience; the server always re-reads them from the DB.
async function mintToken(u, env) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90;
  return await signJwt({
    sub: u.username, tv: u.token_version,
    list_id: u.list_id, is_admin: u.is_admin, is_owner: u.is_owner, exp
  }, env.JWT_SECRET);
}

// Username is a by-value copy — not a foreign key — inside list_items.added_by
// and list_items.edited_by, meal_plan.responsible, recurring_schedule.responsible,
// users.created_by, password_resets.username, and push_subscriptions.username
// (see TODO #17), so renaming it means updating every one of those alongside
// the users row itself, in one batch so they can't drift apart. Callers must
// mint a fresh token afterward — the caller's existing JWT's `sub` now points
// at a row that no longer exists.
// Updates every by-value username copy except list_presence.username
// (TODO-92, deliberate): a presence row is a ~20s heartbeat, not durable
// data — a stale one under the old username ages out and gets rewritten
// fresh on that device's next poll regardless, so cascading into it here
// would just be extra work for a self-healing table.
async function renameUsername(env, oldUsername, newUsername) {
  await env.DB.batch([
    env.DB.prepare("UPDATE list_items SET added_by = ?1 WHERE added_by = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE list_items SET edited_by = ?1 WHERE edited_by = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE meal_plan SET responsible = ?1 WHERE responsible = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE recurring_schedule SET responsible = ?1 WHERE responsible = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE users SET created_by = ?1 WHERE created_by = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE password_resets SET username = ?1 WHERE username = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE push_subscriptions SET username = ?1 WHERE username = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE users SET username = ?1, email = ?1 WHERE username = ?2 COLLATE NOCASE").bind(newUsername, oldUsername),
  ]);
}

// meal_plan.responsible/recurring_schedule.responsible are deliberately free
// text (a household member not on this list yet, e.g. "Grandma", or the
// planner's "Other..." fallback) — so this can't require a list-member match.
// It only rejects the one genuinely unsafe case: text that happens to equal a
// *real* username belonging to a different list. Left alone, that value would
// sit there looking like a real assignment, and renameUsername's by-value
// cascade (unscoped by list_id) would silently rewrite it if that other
// account ever renamed — a cross-tenant leak. A same-list member's username is
// always fine, matching the free-text case is always fine.
async function validateResponsible(env, list_id, responsible) {
  if (!responsible) return true;
  const match = await env.DB.prepare(
    "SELECT list_id FROM users WHERE username = ?1 COLLATE NOCASE"
  ).bind(responsible).first();
  return !match || match.list_id === list_id;
}

// Site-wide metrics (across every list) are gated beyond ordinary is_admin
// (which is deliberately per-list) via this env var — a comma-separated
// allowlist of usernames, set as a Worker dashboard variable alongside
// JWT_SECRET, never committed.
export function isSuperAdmin(username, env) {
  const allowed = (env.SUPERADMIN_USERNAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes((username || "").toLowerCase());
}

// Bounds GET /storage/boxes's payload (every live box + every box's items,
// in one response) — every other bounded thing in this app has a cap too
// (10 users, 710 catalogue items).
const STORAGE_BOX_CAP = 300;

// Builds the same {token, user, is_admin, is_owner, list_id, is_superadmin}
// shape that /login, /register, /reset-password, and /auth/google all return,
// so the frontend has one response shape to store regardless of which path
// authenticated the user.
async function authResponse(row, env) {
  const token = await mintToken(row, env);
  return {
    token, user: row.username, name: row.name || row.username,
    is_admin: row.is_admin, is_owner: row.is_owner, list_id: row.list_id,
    is_superadmin: isSuperAdmin(row.username, env),
  };
}

// ---------- abuse protection for public signup/recovery endpoints ----------
// Generalizes login_attempts' delete-expired-then-count pattern (IP-keyed,
// opportunistic cleanup, no cron) across multiple independent endpoints via a
// `kind` discriminator, so /register and /forgot-password each get their own
// window/threshold without a near-duplicate table per endpoint.
const RATE_LIMITS = {
  register: { windowMs: 60 * 60 * 1000, max: 8 },        // 8/hour/IP
  forgot_password: { windowMs: 60 * 60 * 1000, max: 5 }, // 5/hour/IP
  feedback: { windowMs: 60 * 60 * 1000, max: 5 },        // 5/hour/IP
  invite_redeem: { windowMs: 60 * 60 * 1000, max: 8 },   // 8/hour/IP
  recipe_import: { windowMs: 60 * 60 * 1000, max: 20 },  // 20/hour/IP
};
async function checkRateLimit(env, ip, kind) {
  const { windowMs, max } = RATE_LIMITS[kind];
  const windowStart = Date.now() - windowMs;
  await env.DB.prepare("DELETE FROM rate_limit_attempts WHERE kind = ?1 AND created_at < ?2")
    .bind(kind, windowStart).run();
  const { attempts } = await env.DB.prepare(
    "SELECT COUNT(*) AS attempts FROM rate_limit_attempts WHERE kind = ?1 AND ip = ?2 AND created_at >= ?3"
  ).bind(kind, ip, windowStart).first();
  return attempts < max;
}
async function recordAttempt(env, ip, kind) {
  await env.DB.prepare("INSERT INTO rate_limit_attempts (ip, kind, created_at) VALUES (?1, ?2, ?3)")
    .bind(ip, kind, Date.now()).run();
}

// ---------- Cloudflare Turnstile verification ----------
async function verifyTurnstile(token, ip, env) {
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY || "", response: token, remoteip: ip });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = await res.json();
    return data.success === true;
  } catch { return false; }
}

// Every other sendEmail() call so far only interpolates fixed URLs/usernames
// (already sanitized elsewhere) into the HTML body — /feedback is the first
// to embed real free-text user input, so it needs this to avoid the email
// client rendering stray HTML the sender typed.
export function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- transactional email (Resend) ----------
// The sending address needs a domain DNS-verified in Resend's dashboard
// (manual, one-time — see CLAUDE.md/the signup feature's PR description), so
// it's configured via wrangler.toml's EMAIL_FROM_ADDRESS var rather than
// hardcoded — it can legitimately stay pinned to a different domain than
// APP_ORIGIN (the user-facing app URL) if that's where Resend is verified.
const DEFAULT_EMAIL_FROM = "Panhandle <noreply@panhandle.app>";
async function sendEmail(env, { to, subject, html, replyTo }) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM_ADDRESS || DEFAULT_EMAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: [replyTo] } : {}) }),
    });
    if (!res.ok) console.error("Resend send failed", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("Resend fetch threw", e);
    return false;
  }
}

async function sha256Hex(str) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------- ICS calendar feed (GET /calendar/{token}.ics) ----------
// RFC 5545 (iCalendar) helpers, kept as small pure functions independent of
// the DB/request so they're directly unit-testable (tests/worker-unit.test.mjs).

// RFC 5545 §3.3.11 TEXT escaping. Backslash must be escaped first, or the
// backslashes these replacements insert would themselves get re-escaped.
export function escapeIcsText(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// RFC 5545 §3.1 line folding: a content line over 75 octets must be
// soft-wrapped as CRLF + a single leading space, or some calendar clients
// (Outlook in particular) silently truncate the unfolded remainder.
export function foldIcsLine(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  let result = "";
  let i = 0;
  let first = true;
  while (i < bytes.length) {
    const limit = first ? 75 : 74; // continuation lines lose 1 octet to the leading space
    let end = Math.min(i + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a UTF-8 sequence
    result += (first ? "" : "\r\n ") + new TextDecoder().decode(bytes.slice(i, end));
    i = end;
    first = false;
  }
  return result;
}

// Scopes+annotates raw meal_plan/meal_catalogue rows for the feed.
// scope="mine" keeps only the requesting user's own days; "all" keeps every
// row. `responsible` isn't always a real username — the meal planner lets it
// be free text (e.g. the "Other" fallback) — so display-name resolution
// falls back to the raw string when no list member matches.
export function scopeFilterRows(rows, { scope, username, nameByUsername }) {
  const lowerUsername = (username || "").toLowerCase();
  return rows
    .filter((r) => scope !== "mine" || (r.responsible || "").toLowerCase() === lowerUsername)
    .map((r) => ({
      plan_date: r.plan_date,
      meal_name: r.meal_name || null,
      responsible_display: nameByUsername.get((r.responsible || "").toLowerCase()) || r.responsible || null,
    }));
}

// Pure serializer: scope-filtered rows -> full VCALENDAR text. One all-day
// VEVENT per row that has a meal name; a planned day with no meal chosen yet
// (meal_name null) is skipped rather than emitting an empty event. UID is
// keyed on plan_date (unique per list, per meal_plan's own UNIQUE(list_id,
// plan_date)) so a client that caches by UID sees an edited day update in
// place instead of duplicating.
export function buildIcsFeed(rows, { showResponsible = false, calendarName = "Panhandle meal plan" } = {}) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Panhandle//Meal Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];
  for (const row of rows) {
    if (!row.meal_name) continue;
    const summary = showResponsible && row.responsible_display
      ? `${row.meal_name} – ${row.responsible_display}`
      : row.meal_name;
    lines.push(
      "BEGIN:VEVENT",
      `UID:plan-${row.plan_date}@panhandle.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${row.plan_date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addDaysIso(row.plan_date, 1).replace(/-/g, "")}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

// ---------- "Sign in with Google" ID token verification ----------
// Public by nature (shipped in frontend JS), so it's hardcoded like other
// public config (API_BASE, pagesUrl.hostname) rather than routed through env.
const GOOGLE_CLIENT_ID = "148854883648-86vjm8s2ihc50pjl9sj4t0nj0pe98dh3.apps.googleusercontent.com";

let googleJwksCache = null;
async function getGoogleJwks() {
  if (googleJwksCache) return googleJwksCache;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  googleJwksCache = await res.json();
  return googleJwksCache;
}

// Verifies a Google Identity Services ID token entirely by hand (RS256, via
// Web Crypto), the same no-external-deps ethos as this file's own HS256
// signJwt/verifyJwt — just someone else's keys instead of our own secret.
// Returns the decoded payload (with a verified email) or null.
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  let header, payload;
  try {
    header = JSON.parse(b64urlDecode(headerB64));
    payload = JSON.parse(b64urlDecode(bodyB64));
  } catch { return null; }

  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  if (payload.aud !== GOOGLE_CLIENT_ID) return null;
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") return null;
  if (!payload.email || payload.email_verified !== true) return null;

  const jwks = await getGoogleJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const signedData = new TextEncoder().encode(`${headerB64}.${bodyB64}`);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sigBytes, signedData);
    return ok ? payload : null;
  } catch { return null; }
}

// ---------- main ----------
// Sends one push notification to one subscription, deleting the row if the
// push service reports it's gone (404/410 — the standard signal a
// subscription has expired or been revoked, distinct from a transient
// delivery failure). VAPID's `sub` claim (RFC 8292 requires a mailto:/https:
// contact URI) reuses the existing FEEDBACK_EMAIL secret rather than adding
// a new env var.
async function sendPushToSubscription(env, sub, payload) {
  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK: JSON.parse(env.VAPID_PRIVATE_KEY),
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message: { payload, adminContact: `mailto:${env.FEEDBACK_EMAIL}` },
    });
    const res = await fetch(endpoint, { method: "POST", headers, body });
    if (res.status === 404 || res.status === 410) {
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1").bind(sub.endpoint).run();
    }
  } catch (e) {
    // Don't let one bad subscription (network hiccup, malformed keys) abort
    // the fan-out to the rest of a list's devices.
    console.error("push send failed", e?.message ?? e);
  }
}

// Fans a push out to every subscribed device on a list, optionally skipping
// some usernames' devices (e.g. whoever triggered the event already knows).
// Shared by every notification type (TODO #7 phases 1-2) so there's one
// fan-out implementation, not one per type.
export async function sendPushToList(env, list_id, payload, { excludeUsernames = [] } = {}) {
  const { results: subs } = await env.DB.prepare(
    "SELECT endpoint, p256dh, auth, username FROM push_subscriptions WHERE list_id = ?1"
  ).bind(list_id).all();
  const targets = subs.filter((s) => !excludeUsernames.includes(s.username));
  await Promise.all(targets.map((sub) => sendPushToSubscription(env, sub, payload)));
}

// The "no meal planned for tomorrow" reminder (TODO #7 phase 1).
// Reminders are per-device (device-only notifications): each subscription
// carries its own enabled/time, so this iterates push_subscriptions rather
// than a shared per-list setting — one member can't toggle another's
// reminders. `suppressedEndpoints` holds devices the weekly reminder already
// fired for on this same tick (see runNotificationPass / #91) — skip them so a
// fully unplanned upcoming Sunday->week doesn't produce two back-to-back
// pushes to the same device.
async function checkMealReminders(env, nowMs, suppressedEndpoints = new Set()) {
  const { hhmm, tomorrow } = osloLocalDateParts(nowMs);
  const { results: subs } = await env.DB.prepare(
    "SELECT endpoint, p256dh, auth, list_id, meal_reminder_time FROM push_subscriptions WHERE meal_reminder_enabled = 1"
  ).all();
  const dueSubs = subs.filter((s) => isReminderDue(hhmm, s.meal_reminder_time));

  // A list's "is tomorrow planned?" answer is shared across its devices —
  // look it up once per list, not once per subscription.
  const plannedByList = new Map();
  for (const sub of dueSubs) {
    if (suppressedEndpoints.has(sub.endpoint)) continue; // weekly reminder already sent to this device this tick (#91)
    if (!plannedByList.has(sub.list_id)) {
      const plan = await env.DB.prepare(
        "SELECT meal_id FROM meal_plan WHERE list_id = ?1 AND plan_date = ?2"
      ).bind(sub.list_id, tomorrow).first();
      plannedByList.set(sub.list_id, !!(plan && plan.meal_id !== null));
    }
    if (plannedByList.get(sub.list_id)) continue; // already planned

    // Per-device dedup guard: INSERT OR IGNORE fails silently (changes === 0)
    // if this device/date was already notified today — including a second cron
    // tick that resolves to the same local hhmm on an Oslo DST fall-back day.
    const inserted = await env.DB.prepare(
      "INSERT OR IGNORE INTO notification_device_log (endpoint, list_id, type, target_date) VALUES (?1, ?2, 'meal_reminder', ?3)"
    ).bind(sub.endpoint, sub.list_id, tomorrow).run();
    if (inserted.meta.changes === 0) continue;

    // Kept minimal — encrypted Web Push payloads have a ~4KB ceiling and
    // there's no reason to carry meal data for a "plan something" nudge.
    await sendPushToSubscription(env, sub, {
      title: "Ingen middag planlagt i morgen",
      body: "Åpne Panhandle for å planlegge middag.",
      url: "/app.html",
    });
  }
}

// The weekly meal-plan reminder (TODO #7 phase 2). Fires only on Sunday
// evening (day hardcoded rather than a configurable column — this is a
// low-frequency nudge, not worth another setting), and only when the
// upcoming Mon-Sun week has zero planned meals at all — not "few," which
// would need an arbitrary threshold and risks nagging a household that's
// already started. `dow` is 0=Mon..6=Sun (see osloLocalDateParts).
// Returns the Set of device endpoints it actually sent a weekly reminder to on
// this tick, so runNotificationPass can suppress the daily meal reminder for
// those same devices (#91). Empty on any non-Sunday tick. Like the daily
// reminder this is per-device (see checkMealReminders).
async function checkWeeklyReminders(env, nowMs) {
  const notified = new Set();
  const { hhmm, tomorrow, dow } = osloLocalDateParts(nowMs);
  if (dow !== 6) return notified; // only Sunday

  const { results: subs } = await env.DB.prepare(
    "SELECT endpoint, p256dh, auth, list_id, weekly_reminder_time FROM push_subscriptions WHERE weekly_reminder_enabled = 1"
  ).all();
  const dueSubs = subs.filter((s) => isReminderDue(hhmm, s.weekly_reminder_time));
  if (dueSubs.length === 0) return notified;

  // Today is Sunday, so `tomorrow` is already the upcoming week's Monday.
  const weekStart = tomorrow;
  const weekEnd = addDaysIso(weekStart, 6);

  // A list's "is next week planned?" answer is shared across its devices.
  const plannedByList = new Map();
  for (const sub of dueSubs) {
    if (!plannedByList.has(sub.list_id)) {
      const planned = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM meal_plan WHERE list_id = ?1 AND plan_date BETWEEN ?2 AND ?3 AND meal_id IS NOT NULL"
      ).bind(sub.list_id, weekStart, weekEnd).first();
      plannedByList.set(sub.list_id, planned.n > 0);
    }
    if (plannedByList.get(sub.list_id)) continue; // week already has at least one meal planned

    const inserted = await env.DB.prepare(
      "INSERT OR IGNORE INTO notification_device_log (endpoint, list_id, type, target_date) VALUES (?1, ?2, 'weekly_reminder', ?3)"
    ).bind(sub.endpoint, sub.list_id, weekStart).run();
    if (inserted.meta.changes === 0) continue;

    await sendPushToSubscription(env, sub, {
      title: "Ingen middager planlagt neste uke",
      body: "Åpne Panhandle for å planlegge ukens middager.",
      url: "/app.html",
    });
    notified.add(sub.endpoint);
  }
  return notified;
}

// Cron entry point (TODO #7 phases 1-2), dispatching to each independently
// testable notification-type check. Exported (not just called from
// `scheduled` below) and takes `now` as a parameter rather than reading
// Date.now() internally, so integration tests can call it directly with a
// fabricated timestamp against a real local D1, instead of depending on
// wrangler dev's scheduled-event simulation.
export async function runNotificationPass(env, nowMs) {
  // Weekly first: on a Sunday where the upcoming week is completely unplanned,
  // the weekly reminder and the daily "no meal tomorrow" reminder would both
  // be due at the same tick and fire back-to-back. Suppress the daily one for
  // any device the weekly reminder just sent to (#91).
  const weeklyNotifiedEndpoints = await checkWeeklyReminders(env, nowMs);
  await checkMealReminders(env, nowMs, weeklyNotifiedEndpoints);
}

// Stable content hash of a COMMON_ITEMS-shaped array, used by
// checkCatalogueSync to detect whether the array changed since the last
// cron tick without diffing every list's catalogue every 15 minutes.
async function hashCommonItems(items) {
  const bytes = new TextEncoder().encode(JSON.stringify(items));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Keeps every existing list's item_catalogue backfilled with the current
// COMMON_ITEMS set, so a household created before an item was added doesn't
// permanently miss it (see COMMON_ITEMS's doc comment for the rollout
// story this replaces). Cron-driven, cheap on every tick where COMMON_ITEMS
// hasn't changed (one row read, no writes) — the full cross-list backfill
// only runs when its hash no longer matches catalogue_sync_state.
// `items` defaults to COMMON_ITEMS but is a parameter so tests can exercise
// this against a small fixture array instead of the real ~710-item list.
export async function checkCatalogueSync(env, items = COMMON_ITEMS) {
  const hash = await hashCommonItems(items);
  const state = await env.DB.prepare(
    "SELECT items_hash FROM catalogue_sync_state WHERE id = 1"
  ).first();
  if (state?.items_hash === hash) return { synced: false };

  const { results: lists } = await env.DB.prepare("SELECT id FROM lists").all();
  await Promise.all(lists.map((list) =>
    env.DB.batch(items.map((it) =>
      env.DB.prepare(
        "INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3) ON CONFLICT(list_id, name) DO UPDATE SET category = excluded.category"
      ).bind(it.name, it.category, list.id)
    ))
  ));

  await env.DB.prepare(`
    INSERT INTO catalogue_sync_state (id, items_hash, synced_at) VALUES (1, ?1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET items_hash = excluded.items_hash, synced_at = excluded.synced_at
  `).bind(hash).run();

  return { synced: true, listCount: lists.length };
}

// ---------- route dispatch: pattern constants ----------
// Copied verbatim from the former inline `path.match(/^\.\.\.$/)` regexes;
// LIST_ITEM_ID_PATTERN, MEAL_ID_PATTERN and STORAGE_BOX_ID_PATTERN are each
// shared by two route entries (same path, different method) exactly as their
// source (now-removed) `patchMatch`/`delMatch` etc. variables were reused.
const LIST_INVITE_PATTERN = /^\/list-invites\/([^/]+)$/;
const CALENDAR_FEED_PATTERN = /^\/calendar\/([^/]+)\.ics$/;
const ADMIN_RESET_PASSWORD_PATTERN = /^\/admin\/users\/([^/]+)\/reset-password$/;
const ADMIN_FLAGS_PATTERN = /^\/admin\/users\/([^/]+)\/flags$/;
const ADMIN_USER_ID_PATTERN = /^\/admin\/users\/([^/]+)$/;
const LIST_USER_ID_PATTERN = /^\/list-users\/([^/]+)$/;
const LIST_ITEM_ID_PATTERN = /^\/list\/(\d+)$/;
const LIST_ITEM_CATALOGUE_PATTERN = /^\/list\/(\d+)\/catalogue$/;
const LIST_ITEM_TOGGLE_PATTERN = /^\/list\/(\d+)\/toggle$/;
const MEAL_ID_PATTERN = /^\/meals\/(\d+)$/;
const PLAN_DATE_PATTERN = /^\/plan\/(\d{4}-\d{2}-\d{2})$/;
const STORAGE_BOX_BY_NUMBER_PATTERN = /^\/storage\/boxes\/by-number\/(\d+)$/;
const STORAGE_BOX_ID_PATTERN = /^\/storage\/boxes\/(\d+)$/;

// ---------- route dispatch: matcher ----------
// Every dynamic pattern is fully ^...$-anchored with [^/]+/\d+ (never matches
// "/"), so no two entries can ever both match the same path+method — a plain
// linear scan is unambiguous, same as the if-chain it replaces.
function matchRoute(routes, method, path) {
  for (const r of routes) {
    if (r.method !== method) continue;
    if (r.path !== undefined) {
      if (r.path === path) return { handler: r.handler, params: [] };
    } else {
      const m = path.match(r.pattern);
      if (m) return { handler: r.handler, params: [m[1]] };
    }
  }
  return null;
}

// ---------- route dispatch: public handlers ----------
async function handleVersion(ctx) {

      return json({ version: VERSION });
    }

async function handleLogin(ctx) {
  const { request, env } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      // Opportunistic cleanup, same pattern as /plan's meal_plan pruning:
      // drop attempts outside the window on every login, no cron needed.
      await env.DB.prepare("DELETE FROM login_attempts WHERE created_at < ?1").bind(windowStart).run();
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return err("TOO_MANY_LOGIN_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      const { username, password } = body;
      const row = await env.DB.prepare(
        "SELECT username, name, pass_hash, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind((username || "").trim()).first();
      // Always run the PBKDF2 check (against a dummy hash for unknown users) so
      // login latency doesn't reveal whether a username exists.
      const ok = await verifyPassword(password || "", row ? row.pass_hash : DUMMY_PASS_HASH);
      if (!row || !ok) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        return err("BAD_CREDENTIALS", 401);
      }
      return json(await authResponse(row, env));
    }

async function handleRegister(ctx) {
  const { request, env } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "register"))) {
        return err("TOO_MANY_SIGNUP_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      // Recorded regardless of outcome below: account-creation *volume* is the
      // abuse vector here, not just guessing (unlike login_attempts, which
      // only counts failures).
      await recordAttempt(env, ip, "register");

      // Cheap local validation first, before spending Turnstile's external
      // round-trip on a request that was going to be rejected anyway. Username
      // is always the e-mail (see TODO #17) — there's no separate username
      // field to collect.
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return err("ENTER_NAME", 400);
      if (!body.password || body.password.length < 8) {
        return err("PASSWORD_TOO_SHORT", 400);
      }
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return err("INVALID_EMAIL", 400);
      }
      if (textTooLong(body.list_name, TEXT_LIMITS.listName)) {
        return err("TEXT_TOO_LONG", 400);
      }
      if (!(await verifyTurnstile(body.turnstile_token, ip, env))) {
        return err("TURNSTILE_FAILED", 403);
      }
      const existingEmail = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (existingEmail) return err("EMAIL_IN_USE", 409);

      const hash = await hashPassword(body.password);
      const listId = await createList(env, (body.list_name || "").trim() || null);
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, name) VALUES (?1, ?2, 1, 0, 1, ?3, 'self-register', ?4, ?5)"
      ).bind(cleanEmail, hash, listId, cleanEmail, cleanName).run();
      const row = { username: cleanEmail, name: cleanName, token_version: 1, is_admin: 0, is_owner: 1, list_id: listId };
      return json(await authResponse(row, env));
    }

async function handleAuthGoogle(ctx) {
  const { request, env } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      const payload = await verifyGoogleIdToken(body.credential);
      if (!payload) return err("GOOGLE_SIGNIN_FAILED", 401);
      const email = payload.email.toLowerCase();

      let row = await env.DB.prepare(
        "SELECT username, name, token_version, is_admin, is_owner, list_id FROM users WHERE google_sub = ?1"
      ).bind(payload.sub).first();

      if (!row) {
        row = await env.DB.prepare(
          "SELECT username, name, token_version, is_admin, is_owner, list_id FROM users WHERE email = ?1 COLLATE NOCASE"
        ).bind(email).first();
        if (row) {
          // First time this existing (password) account signs in with Google —
          // link it so future Google sign-ins match directly by google_sub.
          await env.DB.prepare("UPDATE users SET google_sub = ?1 WHERE username = ?2 COLLATE NOCASE")
            .bind(payload.sub, row.username).run();
          // Seed the display name from Google once, only if the account
          // doesn't already have one — never overwrites a local edit.
          if (!row.name && payload.name) {
            const seeded = sanitizeDisplayName(payload.name);
            if (seeded) {
              await env.DB.prepare("UPDATE users SET name = ?1 WHERE username = ?2 COLLATE NOCASE")
                .bind(seeded, row.username).run();
              row.name = seeded;
            }
          }
        }
      }

      if (!row) {
        if (!(await checkRateLimit(env, ip, "register"))) {
          return err("TOO_MANY_SIGNUP_ATTEMPTS", 429);
        }
        await recordAttempt(env, ip, "register");
        // Cheap local validation before the PBKDF2 hash below, matching
        // /register's "validate before spending the expensive step" ordering.
        if (textTooLong(body.list_name, TEXT_LIMITS.listName)) {
          return err("TEXT_TOO_LONG", 400);
        }
        // Username is always the e-mail (see TODO #17) — email is already
        // guaranteed fresh here (no row matched google_sub or email above),
        // so there's no clash to resolve like the old local-part-derived
        // username needed.
        const displayName = sanitizeDisplayName(payload.name) || email.split("@")[0];
        // No password is ever handed to the user for a Google-only account —
        // stored as a hash of unknown random bytes so /login always fails
        // safely until they run /forgot-password on this same verified email.
        const hash = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
        const listId = await createList(env, (body.list_name || "").trim() || null);
        await env.DB.prepare(
          "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, google_sub, name) VALUES (?1, ?2, 1, 0, 1, ?3, 'google', ?4, ?5, ?6)"
        ).bind(email, hash, listId, email, payload.sub, displayName).run();
        row = { username: email, name: displayName, token_version: 1, is_admin: 0, is_owner: 1, list_id: listId };
      }

      return json(await authResponse(row, env));
    }

async function handleForgotPassword(ctx) {
  const { request, env } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "forgot_password"))) {
        return err("TOO_MANY_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      await recordAttempt(env, ip, "forgot_password");

      if (!(await verifyTurnstile(body.turnstile_token, ip, env))) {
        return err("TURNSTILE_FAILED", 403);
      }
      // Always the same response regardless of whether the email matched, so
      // this endpoint can't be used to enumerate registered addresses.
      const genericOk = json({ ok: true, message: "Hvis e-posten finnes, er en lenke sendt." });
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!cleanEmail) return genericOk;

      const row = await env.DB.prepare(
        "SELECT username FROM users WHERE email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (!row) return genericOk;

      const rawToken = b64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const tokenHash = await sha256Hex(rawToken);
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO password_resets (username, token_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)"
      ).bind(row.username, tokenHash, now, now + 30 * 60 * 1000).run();

      const resetUrl = `${env.APP_ORIGIN || "https://shop.panhandle.app"}/?reset_token=${rawToken}`;
      await sendEmail(env, {
        to: cleanEmail,
        subject: "Tilbakestill passordet ditt - Panhandle",
        html: `<p>Klikk her for å tilbakestille passordet ditt (lenken er gyldig i 30 minutter):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Hvis du ikke ba om dette, kan du ignorere denne e-posten.</p>`,
      });
      return genericOk;
    }

async function handleResetPassword(ctx) {
  const { request, env } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "forgot_password"))) {
        return err("TOO_MANY_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      if (!body.new_password || body.new_password.length < 8) {
        return err("PASSWORD_TOO_SHORT", 400);
      }
      if (!body.token) return err("INVALID_OR_EXPIRED_LINK", 400);

      const tokenHash = await sha256Hex(body.token);
      const now = Date.now();
      const reset = await env.DB.prepare(
        "SELECT username FROM password_resets WHERE token_hash = ?1 AND expires_at > ?2"
      ).bind(tokenHash, now).first();
      if (!reset) return err("INVALID_OR_EXPIRED_LINK", 400);

      const userRow = await env.DB.prepare(
        "SELECT username, name, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(reset.username).first();
      if (!userRow) return err("USER_NOT_FOUND", 404);

      const hash = await hashPassword(body.new_password);
      const newVersion = userRow.token_version + 1;
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = ?2 WHERE username = ?3 COLLATE NOCASE"
      ).bind(hash, newVersion, userRow.username).run();
      // Invalidate every outstanding reset token for this user, not just the
      // one just used, so an older emailed link can't also be redeemed later.
      await env.DB.prepare("DELETE FROM password_resets WHERE username = ?1").bind(userRow.username).run();

      return json(await authResponse({ ...userRow, token_version: newVersion }, env));
    }

async function handleListInvitePreview(ctx, cap1) {
  const { env } = ctx;
  const invitePreviewMatch = [null, cap1];

      const tokenHash = await sha256Hex(decodeURIComponent(invitePreviewMatch[1]));
      const invite = await env.DB.prepare(
        "SELECT list_id FROM list_invites WHERE token_hash = ?1 AND expires_at > ?2"
      ).bind(tokenHash, Date.now()).first();
      if (!invite) return err("INVALID_OR_EXPIRED_INVITE", 400);
      const list = await env.DB.prepare("SELECT name FROM lists WHERE id = ?1").bind(invite.list_id).first();
      // Any current owner's display name — the invite is a property of the
      // list, not of whichever owner happened to generate it.
      const owner = await env.DB.prepare(
        "SELECT name, username FROM users WHERE list_id = ?1 AND is_owner = 1 ORDER BY username LIMIT 1"
      ).bind(invite.list_id).first();
      return json({ list_name: list?.name || null, inviter_name: owner?.name || owner?.username || null });
    }

async function handleInviteSignup(ctx) {
  const { request, env } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "invite_redeem"))) {
        return err("TOO_MANY_SIGNUP_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      await recordAttempt(env, ip, "invite_redeem");

      if (!body.token) return err("INVALID_OR_EXPIRED_INVITE", 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return err("ENTER_NAME", 400);
      if (!body.password || body.password.length < 8) return err("PASSWORD_TOO_SHORT", 400);
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) return err("INVALID_EMAIL", 400);

      const tokenHash = await sha256Hex(body.token);
      const invite = await env.DB.prepare(
        "SELECT list_id FROM list_invites WHERE token_hash = ?1 AND expires_at > ?2"
      ).bind(tokenHash, Date.now()).first();
      if (!invite) return err("INVALID_OR_EXPIRED_INVITE", 400);

      // Re-checked here, not just at generation time — membership can change
      // between generate and redeem.
      const cap = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE list_id = ?1"
      ).bind(invite.list_id).first();
      if (cap.n >= 10) return err("LIST_FULL", 400);

      const existingEmail = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (existingEmail) return err("EMAIL_IN_USE", 409);

      const hash = await hashPassword(body.password);
      // is_admin/is_owner hardcoded 0 — never taken from the request body,
      // same rule as POST /list-users.
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, name) VALUES (?1, ?2, 1, 0, 0, ?3, 'invite', ?4, ?5)"
      ).bind(cleanEmail, hash, invite.list_id, cleanEmail, cleanName).run();
      await env.DB.prepare("DELETE FROM list_invites WHERE token_hash = ?1").bind(tokenHash).run();

      const row = { username: cleanEmail, name: cleanName, token_version: 1, is_admin: 0, is_owner: 0, list_id: invite.list_id };
      return json(await authResponse(row, env));
    }

async function handleInviteGoogle(ctx) {
  const { request, env } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "invite_redeem"))) {
        return err("TOO_MANY_SIGNUP_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      await recordAttempt(env, ip, "invite_redeem");
      if (!body.token) return err("INVALID_OR_EXPIRED_INVITE", 400);

      const payload = await verifyGoogleIdToken(body.credential);
      if (!payload) return err("GOOGLE_SIGNIN_FAILED", 401);
      const email = payload.email.toLowerCase();

      const tokenHash = await sha256Hex(body.token);
      const invite = await env.DB.prepare(
        "SELECT list_id FROM list_invites WHERE token_hash = ?1 AND expires_at > ?2"
      ).bind(tokenHash, Date.now()).first();
      if (!invite) return err("INVALID_OR_EXPIRED_INVITE", 400);

      const cap = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE list_id = ?1"
      ).bind(invite.list_id).first();
      if (cap.n >= 10) return err("LIST_FULL", 400);

      // Unlike /auth/google, a match here is rejected outright, not logged
      // in — a user belongs to exactly one list, and there's no merge/move
      // flow to transplant an existing account into this one.
      const existing = await env.DB.prepare(
        "SELECT 1 FROM users WHERE google_sub = ?1 OR email = ?2 COLLATE NOCASE"
      ).bind(payload.sub, email).first();
      if (existing) return err("EMAIL_IN_USE", 409);

      const displayName = sanitizeDisplayName(payload.name) || email.split("@")[0];
      // Same "unusable password" trick /auth/google's new-account branch
      // uses — /login always fails for this account.
      const hash = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, google_sub, name) VALUES (?1, ?2, 1, 0, 0, ?3, 'invite-google', ?4, ?5, ?6)"
      ).bind(email, hash, invite.list_id, email, payload.sub, displayName).run();
      await env.DB.prepare("DELETE FROM list_invites WHERE token_hash = ?1").bind(tokenHash).run();

      const row = { username: email, name: displayName, token_version: 1, is_admin: 0, is_owner: 0, list_id: invite.list_id };
      return json(await authResponse(row, env));
    }

async function handleCalendarFeedIcs(ctx, cap1) {
  const { env } = ctx;
  const calendarFeedMatch = [null, cap1];

      const tokenHash = await sha256Hex(decodeURIComponent(calendarFeedMatch[1]));
      const owner = await env.DB.prepare(
        "SELECT username, list_id, ics_scope FROM users WHERE ics_token_hash = ?1"
      ).bind(tokenHash).first();
      if (!owner) return err("CALENDAR_TOKEN_NOT_FOUND", 404);

      const scoped = owner.ics_scope === "mine";
      let q = `SELECT p.plan_date, p.responsible, m.name AS meal_name
        FROM meal_plan p LEFT JOIN meal_catalogue m ON m.id = p.meal_id
        WHERE p.list_id = ?1`;
      const binds = [owner.list_id];
      if (scoped) { q += " AND p.responsible = ?2 COLLATE NOCASE"; binds.push(owner.username); }
      q += " ORDER BY p.plan_date ASC";
      const { results } = await env.DB.prepare(q).bind(...binds).all();

      const { results: listUsers } = await env.DB.prepare(
        "SELECT username, name FROM users WHERE list_id = ?1"
      ).bind(owner.list_id).all();
      const nameByUsername = new Map(listUsers.map((u) => [u.username.toLowerCase(), u.name || u.username]));
      const rows = scopeFilterRows(results, { scope: owner.ics_scope, username: owner.username, nameByUsername });

      const list = await env.DB.prepare("SELECT name FROM lists WHERE id = ?1").bind(owner.list_id).first();
      const ics = buildIcsFeed(rows, {
        showResponsible: !scoped,
        calendarName: list?.name ? `${list.name} meal plan` : "Panhandle meal plan",
      });
      return new Response(ics, {
        headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=1800" },
      });
    }

// ---------- route dispatch: authenticated handlers ----------
async function handleChangePassword(ctx) {
  const { request, env, user } = ctx;

      // Same per-IP throttle as /login, sharing the login_attempts table —
      // a valid JWT (e.g. stolen via a lost device) shouldn't grant unlimited
      // guesses at current_password.
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return err("TOO_MANY_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      const { current_password, new_password } = body;
      if (!new_password || new_password.length < 8) {
        return err("NEW_PASSWORD_TOO_SHORT", 400);
      }
      const row = await env.DB.prepare(
        "SELECT pass_hash, token_version FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      if (!(await verifyPassword(current_password || "", row.pass_hash))) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        // 403, not 401: the caller's token IS valid — it's the supplied
        // current_password that's wrong. The frontend's api() wrapper treats
        // every 401 as an expired session and force-logs-out, so a 401 here
        // would eject the user on a simple typo instead of showing this error.
        return err("WRONG_CURRENT_PASSWORD", 403);
      }
      const newHash = await hashPassword(new_password);
      const newVersion = row.token_version + 1;
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = ?2 WHERE username = ?3 COLLATE NOCASE"
      ).bind(newHash, newVersion, user.username).run();
      const tokenAfter = await mintToken({ ...user, token_version: newVersion }, env);
      return json({ ok: true, token: tokenAfter });
    }

async function handleAccountGet(ctx) {
  const { env, user, authedJson } = ctx;

      const row = await env.DB.prepare(
        "SELECT email, name FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      return authedJson({ email: row.email || null, name: row.name || user.username, username: user.username });
    }

async function handleChangeName(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return authedErr("ENTER_NAME", 400);
      await env.DB.prepare("UPDATE users SET name = ?1 WHERE username = ?2 COLLATE NOCASE")
        .bind(cleanName, user.username).run();
      return authedJson({ ok: true, name: cleanName });
    }

async function handleChangeEmail(ctx) {
  const { request, env, user } = ctx;

      // Same per-IP throttle as /change-password, sharing login_attempts — a
      // stolen token shouldn't grant unlimited current_password guesses, and
      // email is what /forgot-password trusts to reset a password, so setting
      // it needs the same proof-of-password as changing the password itself.
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return err("TOO_MANY_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) return err("INVALID_EMAIL", 400);
      const row = await env.DB.prepare(
        "SELECT pass_hash FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      if (!(await verifyPassword(body.current_password || "", row.pass_hash))) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        // 403, not 401 — see /change-password's note: the token is valid, the
        // supplied password is wrong, and api() force-logs-out on any 401.
        return err("WRONG_PASSWORD", 403);
      }
      const clash = await env.DB.prepare(
        "SELECT 1 FROM users WHERE (email = ?1 COLLATE NOCASE OR username = ?1 COLLATE NOCASE) AND username != ?2 COLLATE NOCASE"
      ).bind(cleanEmail, user.username).first();
      if (clash) return err("EMAIL_IN_USE_OTHER_ACCOUNT", 409);
      // Username always mirrors email (see TODO #17) — renaming cascades into
      // every other table that stores it by value, so this isn't a plain
      // single-column UPDATE. The caller's current JWT becomes stale the
      // instant the rename lands (its `sub` is the old username), same as
      // /change-password's token_version bump — return a fresh token in the
      // body rather than relying on this request's X-Refresh-Token header,
      // which was minted from the pre-rename username and is unusable.
      if (cleanEmail !== user.username.toLowerCase()) {
        await renameUsername(env, user.username, cleanEmail);
      }
      const token = await mintToken({ ...user, username: cleanEmail }, env);
      return json({ ok: true, email: cleanEmail, username: cleanEmail, token });
    }

async function handleAccountDelete(ctx) {
  const { request, env, path, user } = ctx;

      // Same per-IP throttle as /change-password and /change-email.
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return err("TOO_MANY_ATTEMPTS", 429);
      }
      const body = await readJson(request);
      if (!body) return err("INVALID_REQUEST", 400);
      const row = await env.DB.prepare(
        "SELECT pass_hash FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      if (!(await verifyPassword(body.current_password || "", row.pass_hash))) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        // 403, not 401 — see /change-password's note: the token is valid, the
        // supplied password is wrong, and api() force-logs-out on any 401.
        return err("WRONG_PASSWORD", 403);
      }

      // Superadmin accounts can never be self-deleted, full stop — no count
      // check, no override flag. Status comes solely from being named in
      // env.SUPERADMIN_USERNAMES (a Worker dashboard variable this code has
      // no way to edit), so deleting the row is one-way: the only path back
      // is a developer editing that variable by hand.
      if (isSuperAdmin(user.username, env)) {
        return err("CANNOT_DELETE_SUPERADMIN", 400);
      }

      let listDeleted = false;
      if (user.is_owner) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(user.list_id).first();
        if (c.n <= 1) {
          listDeleted = true;
          // Children before parents — list_id/meal_id/catalogue_id FKs are
          // enforced (see DELETE /list/:id/catalogue's cascade comment) but
          // most of them aren't ON DELETE CASCADE from lists itself, so each
          // list-scoped table is cleared explicitly rather than relying on
          // cascade from a single `DELETE FROM lists`.
          await env.DB.batch([
            env.DB.prepare("DELETE FROM list_items WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM item_catalogue WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM meal_plan WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM meal_catalogue WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM recurring_schedule WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM push_subscriptions WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM notification_settings WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM notification_state WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM category_order WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM list_invites WHERE list_id = ?1").bind(user.list_id),
            // storage_box_items cascades automatically from this (its FK is
            // to storage_boxes(id), not lists(id) directly).
            env.DB.prepare("DELETE FROM storage_boxes WHERE list_id = ?1").bind(user.list_id),
            // list_presence references lists(id) without ON DELETE CASCADE, so
            // it must be cleared before the DELETE FROM lists below or that
            // final statement hits a FK violation and aborts the whole batch
            // (a presence row almost always exists — the shopping-list poll
            // upserts one on every load).
            env.DB.prepare("DELETE FROM list_presence WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM users WHERE list_id = ?1").bind(user.list_id),
            env.DB.prepare("DELETE FROM lists WHERE id = ?1").bind(user.list_id),
          ]);
        }
      }
      if (!listDeleted) {
        // A push subscription is a live credential, not historical data like
        // added_by/responsible — a departing user shouldn't keep receiving
        // this list's reminders on their device.
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE username = ?1")
          .bind(user.username).run();
        // Deleting the row makes requireAuth's DB lookup fail (no row) on the
        // user's next request → 401 → re-login, so no token_version bump
        // needed — same reasoning as DELETE /list-users.
        await env.DB.prepare("DELETE FROM users WHERE username = ?1 COLLATE NOCASE")
          .bind(user.username).run();
      }
      return json({ ok: true, list_deleted: listDeleted });
    }

async function handleFeedback(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "feedback"))) {
        return authedErr("TOO_MANY_FEEDBACK", 429);
      }
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      // Recorded regardless of outcome below, same as /register and
      // /forgot-password — request volume is the abuse vector, not just
      // successful sends.
      await recordAttempt(env, ip, "feedback");
      const message = (body.message || "").trim();
      if (!message) return authedErr("EMPTY_MESSAGE", 400);
      if (message.length > 4000) return authedErr("MESSAGE_TOO_LONG", 400);
      if (!env.FEEDBACK_EMAIL) {
        return authedErr("FEEDBACK_NOT_CONFIGURED", 500);
      }
      // Sender identity survives even through Resend's shared "from" address:
      // the username is in the subject line (visible in an inbox list without
      // opening the email) and repeated in the body, and — when the sender
      // has an email on file — set as reply-to so replying goes straight to
      // them instead of the noreply@ address in "from".
      const acct = await env.DB.prepare(
        "SELECT email FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      const sent = await sendEmail(env, {
        to: env.FEEDBACK_EMAIL,
        replyTo: acct?.email || undefined,
        subject: `Tilbakemelding fra ${user.username}`,
        html: `<p><strong>${escapeHtml(user.username)}</strong> sendte en tilbakemelding fra Panhandle:</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
      });
      if (!sent) return authedErr("FEEDBACK_SEND_FAILED", 502);
      return authedJson({ ok: true });
    }

async function handleAdminOwnersPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      if (!user.is_admin) return authedErr("REQUIRES_ADMIN", 403);
      if (!isSuperAdmin(user.username, env)) return authedErr("REQUIRES_SUPERADMIN", 403);
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) return authedErr("INVALID_EMAIL", 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return authedErr("ENTER_NAME", 400);
      const exists = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (exists) return authedErr("EMAIL_IN_USE", 409);
      const password = genPassword();
      const hash = await hashPassword(password);
      const listId = await createList(env);
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, name) VALUES (?1, ?2, 1, 0, 1, ?3, ?4, ?5, ?6)"
      ).bind(cleanEmail, hash, listId, user.username, cleanEmail, cleanName).run();
      return authedJson({ username: cleanEmail, password });
    }

async function handleAdminUsersGet(ctx) {
  const { env, user, authedJson, authedErr } = ctx;

      if (!user.is_admin) return authedErr("REQUIRES_ADMIN", 403);
      const scoped = !isSuperAdmin(user.username, env);
      const { results } = await (scoped
        ? env.DB.prepare(
            "SELECT username, name, is_admin, is_owner, list_id, created_by FROM users WHERE list_id = ?1 ORDER BY list_id, username"
          ).bind(user.list_id)
        : env.DB.prepare(
            "SELECT username, name, is_admin, is_owner, list_id, created_by FROM users ORDER BY list_id, username"
          )
      ).all();
      return authedJson(results);
    }

async function handleAdminUserResetPassword(ctx, cap1) {
  const { env, user, authedJson, authedErr } = ctx;
  const rpMatch = [null, cap1];

      if (!user.is_admin) return authedErr("REQUIRES_ADMIN", 403);
      const target = decodeURIComponent(rpMatch[1]);
      const row = await env.DB.prepare(
        "SELECT username, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      const callerIsSuperAdmin = isSuperAdmin(user.username, env);
      if (!row || (!callerIsSuperAdmin && row.list_id !== user.list_id)) {
        return authedErr("USER_NOT_FOUND", 404);
      }
      if (!callerIsSuperAdmin && isSuperAdmin(row.username, env)) {
        return authedErr("CANNOT_RESET_SUPERADMIN", 403);
      }
      const password = genPassword();
      const hash = await hashPassword(password);
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = token_version + 1 WHERE username = ?2 COLLATE NOCASE"
      ).bind(hash, row.username).run();
      return authedJson({ username: row.username, password });
    }

async function handleAdminUserFlags(ctx, cap1) {
  const { request, env, user, authedJson, authedErr } = ctx;
  const flagMatch = [null, cap1];

      if (!user.is_admin) return authedErr("REQUIRES_ADMIN", 403);
      const target = decodeURIComponent(flagMatch[1]);
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const row = await env.DB.prepare(
        "SELECT username, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      const callerIsSuperAdmin = isSuperAdmin(user.username, env);
      if (!row || (!callerIsSuperAdmin && row.list_id !== user.list_id)) {
        return authedErr("USER_NOT_FOUND", 404);
      }
      if (!callerIsSuperAdmin && isSuperAdmin(row.username, env)) {
        return authedErr("CANNOT_CHANGE_SUPERADMIN", 403);
      }
      let newAdmin = row.is_admin, newOwner = row.is_owner;
      if (body.is_admin !== undefined) newAdmin = body.is_admin ? 1 : 0;
      if (body.is_owner !== undefined) newOwner = body.is_owner ? 1 : 0;
      // Never let a list lose its last admin.
      if (row.is_admin === 1 && newAdmin === 0) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND list_id = ?1"
        ).bind(row.list_id).first();
        if (c.n <= 1) return authedErr("LAST_ADMIN_REMOVE", 400);
      }
      // Never let a list lose its only owner.
      if (row.is_owner === 1 && newOwner === 0) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(row.list_id).first();
        if (c.n <= 1) return authedErr("WOULD_LOSE_ONLY_OWNER", 400);
      }
      await env.DB.prepare(
        "UPDATE users SET is_admin = ?1, is_owner = ?2, token_version = token_version + 1 WHERE username = ?3 COLLATE NOCASE"
      ).bind(newAdmin, newOwner, row.username).run();
      return authedJson({ ok: true, username: row.username, is_admin: newAdmin, is_owner: newOwner });
    }

async function handleAdminUserDelete(ctx, cap1) {
  const { request, env, path, user, authedJson, authedErr } = ctx;
  const adminDelMatch = [null, cap1];

      if (!user.is_admin) return authedErr("REQUIRES_ADMIN", 403);
      if (!isSuperAdmin(user.username, env)) return authedErr("REQUIRES_SUPERADMIN", 403);
      const target = decodeURIComponent(adminDelMatch[1]);
      const body = await readJson(request);
      const row = await env.DB.prepare(
        "SELECT username, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row) return authedErr("USER_NOT_FOUND", 404);
      // Same unconditional guard as DELETE /account's self-delete path —
      // superadmins can't delete each other's accounts either, even here on
      // the superadmin-only force-delete endpoint. See that guard's comment.
      if (isSuperAdmin(row.username, env)) {
        return authedErr("CANNOT_DELETE_SUPERADMIN", 400);
      }
      if (row.is_admin === 1) {
        const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").first();
        if (c.n <= 1) return authedErr("LAST_ADMIN_DELETE", 400);
      }
      let listDeleted = false;
      if (row.is_owner === 1) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(row.list_id).first();
        if (c.n <= 1) {
          if (!body?.delete_list) return authedErr("WOULD_LOSE_ONLY_OWNER", 400);
          listDeleted = true;
          // Children before parents — same cascade as DELETE /account's
          // last-owner self-deletion path (see its comment for why each
          // list-scoped table is cleared explicitly rather than relying on
          // an ON DELETE CASCADE from `lists` itself).
          await env.DB.batch([
            env.DB.prepare("DELETE FROM list_items WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM item_catalogue WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM meal_plan WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM meal_catalogue WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM recurring_schedule WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM push_subscriptions WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM notification_settings WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM notification_state WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM category_order WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM list_invites WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM storage_boxes WHERE list_id = ?1").bind(row.list_id),
            // See DELETE /account's cascade: list_presence has no ON DELETE
            // CASCADE, so it must go before DELETE FROM lists or the batch
            // aborts on a FK violation.
            env.DB.prepare("DELETE FROM list_presence WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM users WHERE list_id = ?1").bind(row.list_id),
            env.DB.prepare("DELETE FROM lists WHERE id = ?1").bind(row.list_id),
          ]);
        }
      }
      if (!listDeleted) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE username = ?1")
          .bind(row.username).run();
        await env.DB.prepare("DELETE FROM users WHERE username = ?1 COLLATE NOCASE")
          .bind(row.username).run();
      }
      return authedJson({ ok: true, list_deleted: listDeleted });
    }

async function handleAdminMetrics(ctx) {
  const { env, user, authedJson, authedErr } = ctx;

      if (!user.is_admin) return authedErr("REQUIRES_ADMIN", 403);
      if (!isSuperAdmin(user.username, env)) return authedErr("REQUIRES_SUPERADMIN", 403);

      const [
        listCount, userCount, roleCounts,
        signupsByWeek, listsByWeek,
        itemStats, itemsByWeek, topItems,
        mealPlanFill, topMeals,
        perList, recentFailedLogins,
      ] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS n FROM lists").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM users").first(),
        env.DB.prepare(
          "SELECT SUM(is_admin) AS admins, SUM(is_owner) AS owners FROM users"
        ).first(),
        env.DB.prepare(
          "SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n FROM users GROUP BY week ORDER BY week"
        ).all(),
        env.DB.prepare(
          "SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n FROM lists GROUP BY week ORDER BY week"
        ).all(),
        env.DB.prepare(
          "SELECT COUNT(*) AS total, SUM(bought) AS bought FROM list_items"
        ).first(),
        env.DB.prepare(
          "SELECT strftime('%Y-%W', added_at) AS week, COUNT(*) AS n FROM list_items GROUP BY week ORDER BY week"
        ).all(),
        env.DB.prepare(
          "SELECT name, SUM(times_bought) AS n FROM item_catalogue GROUP BY name ORDER BY n DESC LIMIT 10"
        ).all(),
        env.DB.prepare(
          "SELECT COUNT(*) AS total, SUM(CASE WHEN meal_id IS NOT NULL THEN 1 ELSE 0 END) AS filled FROM meal_plan"
        ).first(),
        env.DB.prepare(
          "SELECT name, SUM(times_planned) AS n FROM meal_catalogue GROUP BY name ORDER BY n DESC LIMIT 10"
        ).all(),
        env.DB.prepare(`
          SELECT l.id AS list_id,
                 (SELECT COUNT(*) FROM users u WHERE u.list_id = l.id) AS users,
                 (SELECT COUNT(*) FROM item_catalogue c WHERE c.list_id = l.id) AS items,
                 (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id AND li.bought = 1) AS bought
          FROM lists l ORDER BY l.id
        `).all(),
        env.DB.prepare(
          "SELECT COUNT(*) AS n FROM login_attempts WHERE created_at >= ?1"
        ).bind(Date.now() - 24 * 60 * 60 * 1000).first(),
      ]);

      return authedJson({
        overview: {
          lists: listCount.n, users: userCount.n,
          admins: roleCounts.admins || 0, owners: roleCounts.owners || 0,
        },
        signups_by_week: signupsByWeek.results,
        lists_by_week: listsByWeek.results,
        shopping: {
          total_items: itemStats.total || 0, bought_items: itemStats.bought || 0,
          items_by_week: itemsByWeek.results, top_items: topItems.results,
        },
        meals: {
          plan_total: mealPlanFill.total || 0, plan_filled: mealPlanFill.filled || 0,
          top_meals: topMeals.results,
        },
        per_list: perList.results,
        failed_logins_24h: recentFailedLogins.n,
      });
    }

async function handleListUsersGet(ctx) {
  const { env, user, authedJson } = ctx;

      const { results } = await env.DB.prepare(
        "SELECT username, name, is_admin, is_owner FROM users WHERE list_id = ?1 ORDER BY username"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

async function handleListUsersPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      if (!user.is_owner) return authedErr("REQUIRES_OWNER", 403);
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const cleanEmail = (body.email || "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) return authedErr("INVALID_EMAIL", 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return authedErr("ENTER_NAME", 400);
      const c = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE list_id = ?1"
      ).bind(user.list_id).first();
      if (c.n >= 10) return authedErr("LIST_FULL", 400);
      const exists = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE"
      ).bind(cleanEmail).first();
      if (exists) return authedErr("EMAIL_IN_USE", 409);
      const password = genPassword();
      const hash = await hashPassword(password);
      // is_admin/is_owner are hardcoded 0 — never taken from the request body,
      // so an owner can't self-escalate a member into an admin/owner.
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by, email, name) VALUES (?1, ?2, 1, 0, 0, ?3, ?4, ?5, ?6)"
      ).bind(cleanEmail, hash, user.list_id, user.username, cleanEmail, cleanName).run();
      return authedJson({ username: cleanEmail, password });
    }

async function handleListUserDelete(ctx, cap1) {
  const { request, env, user, authedJson, authedErr } = ctx;
  const luDelMatch = [null, cap1];

      if (!user.is_owner) return authedErr("REQUIRES_OWNER", 403);
      const target = decodeURIComponent(luDelMatch[1]);
      const row = await env.DB.prepare(
        "SELECT username, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row || row.list_id !== user.list_id) {
        return authedErr("USER_NOT_IN_LIST", 404);
      }
      if (row.is_owner === 1) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(user.list_id).first();
        if (c.n <= 1) return authedErr("LAST_OWNER_REMOVE", 400);
      }
      // A push subscription is a live credential, not historical data like
      // added_by/responsible — a removed member shouldn't keep receiving
      // this list's reminders on their device.
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE username = ?1 AND list_id = ?2")
        .bind(row.username, user.list_id).run();
      // Deleting the row makes requireAuth's DB lookup fail (no row) on the
      // user's next request → 401 → re-login, so no token_version bump needed.
      await env.DB.prepare("DELETE FROM users WHERE username = ?1 COLLATE NOCASE")
        .bind(row.username).run();
      return authedJson({ ok: true });
    }

async function handleListInvitesGet(ctx) {
  const { env, user, authedJson, authedErr } = ctx;

      if (!user.is_owner) return authedErr("REQUIRES_OWNER", 403);
      const invite = await env.DB.prepare(
        "SELECT expires_at FROM list_invites WHERE list_id = ?1 AND expires_at > ?2"
      ).bind(user.list_id, Date.now()).first();
      return authedJson({ active: !!invite, expires_at: invite?.expires_at || null });
    }

async function handleListInvitesPost(ctx) {
  const { env, user, authedJson, authedErr } = ctx;

      if (!user.is_owner) return authedErr("REQUIRES_OWNER", 403);
      const rawToken = b64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const tokenHash = await sha256Hex(rawToken);
      const now = Date.now();
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
      // Upsert: generating again replaces/invalidates whatever invite
      // already existed for this list — UNIQUE(list_id) makes this a DB
      // guarantee, not an app-level check-then-write.
      await env.DB.prepare(`
        INSERT INTO list_invites (list_id, token_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(list_id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at, expires_at = excluded.expires_at
      `).bind(user.list_id, tokenHash, now, expiresAt).run();
      return authedJson({ token: rawToken, expires_at: expiresAt });
    }

async function handleListInvitesDelete(ctx) {
  const { env, user, authedJson, authedErr } = ctx;

      if (!user.is_owner) return authedErr("REQUIRES_OWNER", 403);
      await env.DB.prepare("DELETE FROM list_invites WHERE list_id = ?1").bind(user.list_id).run();
      return authedJson({ ok: true });
    }

async function handleCalendarFeedSettingsGet(ctx) {
  const { env, user, authedJson } = ctx;

      const row = await env.DB.prepare(
        "SELECT ics_token_hash, ics_scope FROM users WHERE username = ?1"
      ).bind(user.username).first();
      return authedJson({ active: !!row.ics_token_hash, scope: row.ics_scope });
    }

async function handleCalendarFeedSettingsPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body || (body.scope !== "all" && body.scope !== "mine")) {
        return authedErr("INVALID_REQUEST", 400);
      }
      await env.DB.prepare("UPDATE users SET ics_scope = ?1 WHERE username = ?2")
        .bind(body.scope, user.username).run();
      return authedJson({ scope: body.scope });
    }

async function handleCalendarFeedTokenPost(ctx) {
  const { env, user, authedJson } = ctx;

      const rawToken = b64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const tokenHash = await sha256Hex(rawToken);
      await env.DB.prepare("UPDATE users SET ics_token_hash = ?1 WHERE username = ?2")
        .bind(tokenHash, user.username).run();
      return authedJson({ token: rawToken });
    }

async function handleCalendarFeedTokenDelete(ctx) {
  const { env, user, authedJson } = ctx;

      // Leaves ics_scope untouched — a later regenerate keeps the user's
      // last-chosen scope rather than resetting to the 'all' default.
      await env.DB.prepare("UPDATE users SET ics_token_hash = NULL WHERE username = ?1")
        .bind(user.username).run();
      return authedJson({ ok: true });
    }

async function handlePresence(ctx) {
  const { env, user, authedJson } = ctx;

      await env.DB.prepare(`
        INSERT INTO list_presence (list_id, username, last_seen) VALUES (?1, ?2, datetime('now'))
        ON CONFLICT(list_id, username) DO UPDATE SET last_seen = datetime('now')
      `).bind(user.list_id, user.username).run();
      const { results } = await env.DB.prepare(`
        SELECT username FROM list_presence
        WHERE list_id = ?1 AND username != ?2 AND last_seen > datetime('now', '-20 seconds')
        ORDER BY username
      `).bind(user.list_id, user.username).all();
      return authedJson(results.map((r) => r.username));
    }

async function handleListGet(ctx) {
  const { env, user, authedJson } = ctx;

      const { results } = await env.DB.prepare(`
        SELECT li.id, li.bought, li.important, li.added_by, li.added_at, li.edited_by, li.edited_at, li.bought_at, li.qty, li.notes, c.name, c.category
        FROM list_items li
        JOIN item_catalogue c ON c.id = li.catalogue_id
        WHERE li.list_id = ?1
        ORDER BY li.bought ASC, c.category ASC, c.name ASC
      `).bind(user.list_id).all();
      return authedJson(results);
    }

async function handleListPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { name, category, notes, qty, exact } = body;
      if (textTooLong(name, TEXT_LIMITS.itemName) || textTooLong(notes, TEXT_LIMITS.itemNotes)) {
        return authedErr("TEXT_TOO_LONG", 400);
      }
      // "Legg til nøyaktig som skrevet" means verbatim — skip the gluten-free
      // extraction and auto-capitalization normally applied to typed names.
      let clean, gf;
      if (exact) {
        clean = (name || "").trim();
        gf = false;
      } else {
        const { name: stripped, gf: gfFlag } = extractGlutenFree(name);
        clean = capitalizeName(stripped);
        gf = gfFlag;
      }
      if (!clean) return authedErr("EMPTY_NAME", 400);
      const addQty = Math.max(1, parseInt(qty, 10) || 1);
      // A gluten-free marker pulled out of the name is recorded as a "Glutenfri"
      // note (regardless of how it was typed — "gf", "GF", "glutenfri"), without
      // duplicating one the caller already passed, so the gluten-free variant is
      // tracked as a note rather than a separate catalogue name.
      let noteVal = (notes || "").trim();
      if (gf && !/\b(gf|glutenfri|glutenfritt)\b/i.test(noteVal)) {
        noteVal = noteVal ? `${noteVal} Glutenfri` : "Glutenfri";
      }
      noteVal = noteVal || null;
      let cat = await env.DB.prepare(
        "SELECT id, category FROM item_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
      ).bind(clean, user.list_id).first();
      if (!cat) {
        const chosenCat = CATEGORIES.includes(category) ? category : "Other";
        // Upsert so two concurrent adds of a new name can't collide on the
        // UNIQUE(list_id, name) constraint — the loser gets the existing row.
        cat = await env.DB.prepare(`
          INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3)
          ON CONFLICT(list_id, name) DO UPDATE SET name = name
          RETURNING id, category
        `).bind(clean, chosenCat, user.list_id).first();
      }
      // Merge only into an unbought line whose notes match, so e.g. a plain
      // "Pasta" and a "Pasta" + "GF" note coexist as two separate lines instead
      // of one bumping the other's quantity.
      const existing = await env.DB.prepare(
        "SELECT id FROM list_items WHERE catalogue_id = ?1 AND bought = 0 AND list_id = ?2 AND IFNULL(notes, '') = IFNULL(?3, '')"
      ).bind(cat.id, user.list_id, noteVal).first();
      if (existing) {
        const updated = await env.DB.prepare(
          "UPDATE list_items SET qty = qty + ?2 WHERE id = ?1 RETURNING qty"
        ).bind(existing.id, addQty).first();
        // `id` lets the offline write queue (see src/lib/writeQueue.js) map a
        // temp id to the real line when replaying a queued add — here the
        // merge target's existing id.
        return authedJson({ ok: true, duplicate: true, qty: updated.qty, id: existing.id });
      }
      // No unbought line to merge into — but if this same item/notes combo is
      // sitting bought (e.g. milk bought yesterday, added again today), reopen
      // that line instead of inserting a fresh one. Otherwise every re-buy of
      // a staple piles up its own row, and "Recently bought" (sorted by
      // bought_at) shows the same item repeated instead of it just re-sorting
      // to the top the next time it's bought.
      const existingBought = await env.DB.prepare(
        "SELECT id FROM list_items WHERE catalogue_id = ?1 AND bought = 1 AND list_id = ?2 AND IFNULL(notes, '') = IFNULL(?3, '')"
      ).bind(cat.id, user.list_id, noteVal).first();
      if (existingBought) {
        await env.DB.prepare(`
          UPDATE list_items SET bought = 0, bought_at = NULL, important = 0,
              qty = ?2, added_by = ?3, added_at = datetime('now'),
              edited_by = NULL, edited_at = NULL
          WHERE id = ?1
        `).bind(existingBought.id, addQty, user.username).run();
        return authedJson({ ok: true, qty: addQty, id: existingBought.id });
      }
      const inserted = await env.DB.prepare(
        "INSERT INTO list_items (catalogue_id, added_by, notes, qty, list_id) VALUES (?1, ?2, ?3, ?4, ?5)"
      ).bind(cat.id, user.username, noteVal, addQty, user.list_id).run();
      return authedJson({ ok: true, qty: addQty, id: inserted.meta.last_row_id });
    }

async function handleListMarkAllBought(ctx) {
  const { env, user, authedJson } = ctx;

      await env.DB.prepare(`
        UPDATE item_catalogue SET
          times_bought = times_bought + 1,
          first_bought = COALESCE(first_bought, datetime('now')),
          last_bought = datetime('now')
        WHERE id IN (SELECT catalogue_id FROM list_items WHERE list_id = ?1 AND bought = 0)
      `).bind(user.list_id).run();
      const res = await env.DB.prepare(`
        UPDATE list_items SET bought = 1, bought_at = datetime('now'), important = 0
        WHERE list_id = ?1 AND bought = 0
      `).bind(user.list_id).run();
      return authedJson({ ok: true, marked: res.meta?.changes ?? 0 });
    }

async function handleListItemPatch(ctx, cap1) {
  const { request, env, user, authedJson, authedErr } = ctx;
  const patchMatch = [null, cap1];

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { qty, notes, category, name, important } = body;
      if (textTooLong(name, TEXT_LIMITS.itemName) || textTooLong(notes, TEXT_LIMITS.itemNotes)) {
        return authedErr("TEXT_TOO_LONG", 400);
      }
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(patchMatch[1], user.list_id).first();
      if (!row) return authedErr("ITEM_NOT_FOUND", 404);
      if (important !== undefined) {
        await env.DB.prepare("UPDATE list_items SET important = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(important ? 1 : 0, patchMatch[1], user.list_id).run();
      }
      // "Edited" tracks only the deliberate item-edit-modal fields below, not
      // the important toggle above (a quick star action, not an edit) or
      // bought/toggle — so the item modal's "latest action" line reflects
      // what the edit modal actually changed.
      const isEdit = qty !== undefined || notes !== undefined || category !== undefined || name !== undefined;
      if (qty !== undefined) {
        const cleanQty = Math.max(1, parseInt(qty, 10) || 1);
        await env.DB.prepare("UPDATE list_items SET qty = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(cleanQty, patchMatch[1], user.list_id).run();
      }
      if (notes !== undefined) {
        await env.DB.prepare("UPDATE list_items SET notes = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind((notes || "").trim() || null, patchMatch[1], user.list_id).run();
      }
      if (category !== undefined && CATEGORIES.includes(category)) {
        await env.DB.prepare("UPDATE item_catalogue SET category = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(category, row.catalogue_id, user.list_id).run();
      }
      if (name !== undefined) {
        const cleanName = capitalizeName(name);
        if (!cleanName) return authedErr("EMPTY_NAME", 400);
        const clash = await env.DB.prepare(
          "SELECT id FROM item_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2 AND id != ?3"
        ).bind(cleanName, user.list_id, row.catalogue_id).first();
        if (clash) return authedErr("ITEM_NAME_EXISTS", 400);
        await env.DB.prepare("UPDATE item_catalogue SET name = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(cleanName, row.catalogue_id, user.list_id).run();
      }
      if (isEdit) {
        await env.DB.prepare("UPDATE list_items SET edited_by = ?1, edited_at = datetime('now') WHERE id = ?2 AND list_id = ?3")
          .bind(user.username, patchMatch[1], user.list_id).run();
      }
      return authedJson({ ok: true });
    }

async function handleListItemCatalogueDelete(ctx, cap1) {
  const { env, user, authedJson, authedErr } = ctx;
  const delCatMatch = [null, cap1];

      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(delCatMatch[1], user.list_id).first();
      if (!row) return authedErr("ITEM_NOT_FOUND", 404);
      await env.DB.prepare("DELETE FROM item_catalogue WHERE id = ?1 AND list_id = ?2")
        .bind(row.catalogue_id, user.list_id).run();
      return authedJson({ ok: true });
    }

async function handleListItemToggle(ctx, cap1) {
  const { env, user, authedJson, authedErr } = ctx;
  const toggleMatch = [null, cap1];

      const item = await env.DB.prepare(
        "SELECT bought, catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(toggleMatch[1], user.list_id).first();
      if (!item) return authedErr("ITEM_NOT_FOUND", 404);
      // Important is scoped to "this trip" — marking an item bought clears it
      // (but undoing a bought mark doesn't restore it; that transition only
      // clears, matching the times_bought counting below which only fires on
      // the same 0->1 edge).
      await env.DB.prepare(`
        UPDATE list_items SET bought = CASE bought WHEN 0 THEN 1 ELSE 0 END,
            bought_at = CASE bought WHEN 0 THEN datetime('now') ELSE NULL END,
            important = CASE bought WHEN 0 THEN 0 ELSE important END
        WHERE id = ?1 AND list_id = ?2
      `).bind(toggleMatch[1], user.list_id).run();
      // Only count it as a purchase on the 0->1 transition, not on undo —
      // these lifetime stats power GET /catalogue/suggestions below.
      if (item.bought === 0) {
        await env.DB.prepare(`
          UPDATE item_catalogue SET
            times_bought = times_bought + 1,
            first_bought = COALESCE(first_bought, datetime('now')),
            last_bought = datetime('now')
          WHERE id = ?1
        `).bind(item.catalogue_id).run();
      }
      return authedJson({ ok: true });
    }

async function handleListItemDelete(ctx, cap1) {
  const { env, user, authedJson, authedErr } = ctx;
  const delMatch = [null, cap1];

      const { meta } = await env.DB.prepare("DELETE FROM list_items WHERE id = ?1 AND list_id = ?2")
        .bind(delMatch[1], user.list_id).run();
      if (meta.changes === 0) return authedErr("ITEM_NOT_FOUND", 404);
      return authedJson({ ok: true });
    }

async function handleCatalogueGet(ctx) {
  const { env, user, authedJson } = ctx;

      const { results } = await env.DB.prepare(
        "SELECT name, category FROM item_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

async function handleCatalogueSuggestions(ctx) {
  const { env, user, authedJson } = ctx;

      const { results } = await env.DB.prepare(`
        SELECT c.id, c.name, c.category, c.last_bought,
          (julianday(c.last_bought) - julianday(c.first_bought)) / (c.times_bought - 1) AS avg_interval_days,
          julianday('now') - julianday(c.last_bought) AS days_since
        FROM item_catalogue c
        WHERE c.list_id = ?1
          AND c.times_bought >= 2
          AND NOT EXISTS (SELECT 1 FROM list_items li WHERE li.catalogue_id = c.id AND li.bought = 0)
          AND (julianday('now') - julianday(c.last_bought)) >=
              (julianday(c.last_bought) - julianday(c.first_bought)) / (c.times_bought - 1)
        ORDER BY (days_since - avg_interval_days) DESC
        LIMIT 8
      `).bind(user.list_id).all();
      return authedJson(results);
    }

async function handleCategoryOrderGet(ctx) {
  const { env, user, authedJson } = ctx;

      const { results } = await env.DB.prepare(
        "SELECT category FROM category_order WHERE list_id = ?1 ORDER BY position ASC"
      ).bind(user.list_id).all();
      return authedJson({ order: normalizeCategoryOrder(results.map((r) => r.category)) });
    }

async function handleCategoryOrderPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body || !Array.isArray(body.order)) return authedErr("INVALID_REQUEST", 400);
      // Normalise before storing so the row set is always a full, valid,
      // duplicate-free ordering regardless of what the client sent.
      const order = normalizeCategoryOrder(body.order);
      const stmts = [env.DB.prepare("DELETE FROM category_order WHERE list_id = ?1").bind(user.list_id)];
      order.forEach((cat, i) => {
        stmts.push(
          env.DB.prepare("INSERT INTO category_order (list_id, category, position) VALUES (?1, ?2, ?3)")
            .bind(user.list_id, cat, i)
        );
      });
      await env.DB.batch(stmts);
      return authedJson({ ok: true, order });
    }

async function handleRecipeImport(ctx) {
  const { request, env, authedJson, authedErr } = ctx;

      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip, "recipe_import"))) {
        return authedErr("TOO_MANY_RECIPE_IMPORTS", 429);
      }
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      // Recorded before validation, same as /feedback's recordAttempt placement.
      await recordAttempt(env, ip, "recipe_import");

      let parsedUrl;
      try { parsedUrl = new URL((body.url || "").trim()); } catch { parsedUrl = null; }
      if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
        return authedErr("INVALID_RECIPE_URL", 400);
      }

      let html;
      try {
        const res = await fetch(parsedUrl.toString(), {
          signal: AbortSignal.timeout(8000),
          headers: { "Accept": "text/html", "User-Agent": "PanhandleRecipeImport/1.0 (+https://panhandle.app)" },
        });
        if (!res.ok) return authedErr("RECIPE_FETCH_FAILED", 502);
        html = await readCapped(res.body, RECIPE_FETCH_CAP_BYTES);
      } catch {
        return authedErr("RECIPE_FETCH_FAILED", 502);
      }

      const recipe = parseRecipeFromHtml(html);
      if (!recipe) return authedErr("RECIPE_PARSE_FAILED", 422);
      return authedJson({ ok: true, name: recipe.name, ingredients: recipe.ingredients });
    }

async function handleMealsGet(ctx) {
  const { env, user, authedJson } = ctx;

      const { results } = await env.DB.prepare(
        "SELECT id, name, ingredients, labels, times_planned, last_planned FROM meal_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

async function handleMealsSuggestions(ctx) {
  const { env, user, authedJson } = ctx;

      const { results } = await env.DB.prepare(`
        SELECT id, name, ingredients, labels, times_planned, last_planned
        FROM meal_catalogue
        WHERE list_id = ?1
          AND (last_planned IS NULL OR last_planned <= date('now', '-10 days'))
        ORDER BY times_planned DESC, last_planned ASC
        LIMIT 5
      `).bind(user.list_id).all();
      return authedJson(results);
    }

async function handleMealsPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      if (textTooLong(body.name, TEXT_LIMITS.mealName)) return authedErr("TEXT_TOO_LONG", 400);
      const clean = capitalizeName(body.name);
      if (!clean) return authedErr("EMPTY_NAME", 400);
      const ingredients = sanitizeStringArray(body.ingredients, {
        maxLen: TEXT_LIMITS.mealIngredients, maxItemLen: TEXT_LIMITS.mealIngredient,
      });
      if (ingredients === null) return authedErr("TOO_MANY_ENTRIES", 400);
      const labels = sanitizeLabels(body.labels);
      if (labels === null) return authedErr("TOO_MANY_ENTRIES", 400);
      const ingredientsJson = JSON.stringify(ingredients);
      const labelsJson = JSON.stringify(labels);
      const clash = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
      ).bind(clean, user.list_id).first();
      if (clash) return authedErr("MEAL_NAME_EXISTS", 400);
      const meal = await env.DB.prepare(
        "INSERT INTO meal_catalogue (name, list_id, ingredients, labels) VALUES (?1, ?2, ?3, ?4) RETURNING id"
      ).bind(clean, user.list_id, ingredientsJson, labelsJson).first();
      return authedJson({ ok: true, id: meal.id });
    }

async function handleMealPatch(ctx, cap1) {
  const { request, env, user, authedJson, authedErr } = ctx;
  const mealPatchMatch = [null, cap1];

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const meal = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE id = ?1 AND list_id = ?2"
      ).bind(mealPatchMatch[1], user.list_id).first();
      if (!meal) return authedErr("MEAL_NOT_FOUND", 404);
      if (body.name !== undefined) {
        if (textTooLong(body.name, TEXT_LIMITS.mealName)) return authedErr("TEXT_TOO_LONG", 400);
        const clean = capitalizeName(body.name);
        if (!clean) return authedErr("EMPTY_NAME", 400);
        const clash = await env.DB.prepare(
          "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2 AND id != ?3"
        ).bind(clean, user.list_id, meal.id).first();
        if (clash) return authedErr("MEAL_NAME_EXISTS", 400);
        await env.DB.prepare("UPDATE meal_catalogue SET name = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(clean, meal.id, user.list_id).run();
      }
      if (body.ingredients !== undefined) {
        const ingredients = sanitizeStringArray(body.ingredients, {
          maxLen: TEXT_LIMITS.mealIngredients, maxItemLen: TEXT_LIMITS.mealIngredient,
        });
        if (ingredients === null) return authedErr("TOO_MANY_ENTRIES", 400);
        await env.DB.prepare("UPDATE meal_catalogue SET ingredients = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(JSON.stringify(ingredients), meal.id, user.list_id).run();
      }
      if (body.labels !== undefined) {
        const labels = sanitizeLabels(body.labels);
        if (labels === null) return authedErr("TOO_MANY_ENTRIES", 400);
        await env.DB.prepare("UPDATE meal_catalogue SET labels = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(JSON.stringify(labels), meal.id, user.list_id).run();
      }
      return authedJson({ ok: true });
    }

async function handleMealDelete(ctx, cap1) {
  const { env, user, authedJson } = ctx;
  const mealDelMatch = [null, cap1];

      await env.DB.prepare("DELETE FROM meal_catalogue WHERE id = ?1 AND list_id = ?2")
        .bind(mealDelMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

async function handlePlanGet(ctx) {
  const { env, url, user, authedJson } = ctx;

      // The frontend only ever navigates to last/this/next week (at most 13
      // days before today), so there's no value in keeping plan rows beyond
      // that — opportunistically drop anything older on every read. The
      // 14-day cutoff (vs. 13) is a safety margin against clock/timezone
      // skew between the server's `now` and a client's local "today".
      await env.DB.prepare(
        "DELETE FROM meal_plan WHERE list_id = ?1 AND plan_date < date('now', '-14 days')"
      ).bind(user.list_id).run();
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = `SELECT p.id, p.plan_date, p.responsible, m.name AS meal_name, m.id AS meal_id,
        m.ingredients AS ingredients, m.labels AS labels
        FROM meal_plan p LEFT JOIN meal_catalogue m ON m.id = p.meal_id
        WHERE p.list_id = ?1`;
      const binds = [user.list_id];
      if (from && to) { q += " AND p.plan_date BETWEEN ?2 AND ?3"; binds.push(from, to); }
      q += " ORDER BY p.plan_date ASC";
      const { results } = await env.DB.prepare(q).bind(...binds).all();
      return authedJson(results);
    }

async function handlePlanPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { plan_date, meal_name, responsible, ingredients } = body;
      if (!plan_date || !/^\d{4}-\d{2}-\d{2}$/.test(plan_date)) {
        return authedErr("INVALID_DATE", 400);
      }
      // Require at least one of meal_name or responsible to be set.
      if (!meal_name && !responsible) return authedErr("MISSING_MEAL_OR_RESPONSIBLE", 400);
      if (textTooLong(meal_name, TEXT_LIMITS.mealName) || textTooLong(responsible, TEXT_LIMITS.responsible)) {
        return authedErr("TEXT_TOO_LONG", 400);
      }
      // Sanitized once here and reused below, so the stored value is the
      // coerced/capped array rather than whatever the request body held.
      const cleanIngredients = Array.isArray(ingredients)
        ? sanitizeStringArray(ingredients, {
            maxLen: TEXT_LIMITS.mealIngredients, maxItemLen: TEXT_LIMITS.mealIngredient,
          })
        : undefined;
      if (cleanIngredients === null) return authedErr("TOO_MANY_ENTRIES", 400);
      if (!(await validateResponsible(env, user.list_id, responsible))) {
        return authedErr("RESPONSIBLE_ACCOUNT_MISMATCH", 400);
      }

      // Also used to bump usage stats only when the meal is actually new/changed
      // (below), and now to preserve whichever field the caller omits: `meal_name`
      // or `responsible` being absent from the request means "leave it alone",
      // not "clear it" — distinct from an explicit falsy/empty value, which does
      // clear it. (A full clear of both fields together is DELETE /plan/:date.)
      const prevPlan = await env.DB.prepare(
        "SELECT meal_id, responsible FROM meal_plan WHERE list_id = ?1 AND plan_date = ?2"
      ).bind(user.list_id, plan_date).first();

      let mealId = prevPlan?.meal_id ?? null;
      if (meal_name !== undefined) {
        mealId = null;
        if (meal_name) {
          // Capitalise new meal names the same way item names are (capitalizeName),
          // so a meal typed in the planner is stored "Taco", not "taco". Lookups are
          // COLLATE NOCASE, so this only affects how a genuinely new name is stored.
          const clean = capitalizeName(meal_name);
          // ingredients is a JSON-encoded array, stored once per meal name in
          // meal_catalogue and shared across every occurrence of that meal —
          // undefined means "leave whatever's stored alone".
          const ingredientsJson = cleanIngredients !== undefined ? JSON.stringify(cleanIngredients) : undefined;
          let meal = await env.DB.prepare(
            "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
          ).bind(clean, user.list_id).first();
          if (!meal) {
            // Upsert to avoid a UNIQUE(list_id, name) collision on concurrent first use.
            meal = await env.DB.prepare(`
              INSERT INTO meal_catalogue (name, list_id, ingredients) VALUES (?1, ?2, ?3)
              ON CONFLICT(list_id, name) DO UPDATE SET name = name
              RETURNING id
            `).bind(clean, user.list_id, ingredientsJson ?? "[]").first();
          } else if (ingredientsJson !== undefined) {
            await env.DB.prepare("UPDATE meal_catalogue SET ingredients = ?1 WHERE id = ?2")
              .bind(ingredientsJson, meal.id).run();
          }
          mealId = meal.id;
        }
      }

      const effectiveResponsible = responsible !== undefined ? (responsible || "") : (prevPlan?.responsible ?? "");

      // Only bump usage stats when this date's meal is actually new/changed —
      // re-saving the same date with the same meal (e.g. just changing who's
      // responsible) shouldn't inflate times_planned.
      await env.DB.prepare(`
        INSERT INTO meal_plan (plan_date, meal_id, responsible, list_id)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(list_id, plan_date) DO UPDATE SET
          meal_id = excluded.meal_id,
          responsible = excluded.responsible,
          updated_at = datetime('now')
      `).bind(plan_date, mealId, effectiveResponsible, user.list_id).run();
      if (mealId !== null && (!prevPlan || prevPlan.meal_id !== mealId)) {
        await env.DB.prepare(`
          UPDATE meal_catalogue
          SET times_planned = times_planned + 1,
              last_planned = CASE WHEN last_planned IS NULL OR last_planned < ?1 THEN ?1 ELSE last_planned END
          WHERE id = ?2
        `).bind(plan_date, mealId).run();
      }
      return authedJson({ ok: true });
    }

async function handlePlanDelete(ctx, cap1) {
  const { env, user, authedJson } = ctx;
  const planDelMatch = [null, cap1];

      await env.DB.prepare("DELETE FROM meal_plan WHERE plan_date = ?1 AND list_id = ?2")
        .bind(planDelMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

async function handleRecurringGet(ctx) {
  const { env, user, authedJson } = ctx;

      const rows = await env.DB.prepare(
        "SELECT day_of_week, responsible FROM recurring_schedule WHERE list_id = ?1 ORDER BY day_of_week"
      ).bind(user.list_id).all();
      return authedJson(rows.results);
    }

async function handleRecurringPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { day_of_week, responsible } = body;
      if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6)
        return authedErr("INVALID_DAY", 400);
      if (textTooLong(responsible, TEXT_LIMITS.responsible)) return authedErr("TEXT_TOO_LONG", 400);
      if (!(await validateResponsible(env, user.list_id, responsible))) {
        return authedErr("RESPONSIBLE_ACCOUNT_MISMATCH", 400);
      }
      try {
        if (!responsible) {
          await env.DB.prepare(
            "DELETE FROM recurring_schedule WHERE list_id = ?1 AND day_of_week = ?2"
          ).bind(user.list_id, day_of_week).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO recurring_schedule (list_id, day_of_week, responsible)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(list_id, day_of_week) DO UPDATE SET responsible = excluded.responsible
          `).bind(user.list_id, day_of_week, responsible).run();
        }
      } catch (e) {
        // The raw SQLite message used to be echoed to the client via
        // `detail`, exposing schema internals to an untrusted caller. It now
        // goes to the Worker log only (visible via `wrangler tail`/Logpush),
        // and the response carries the plain code.
        console.error("recurring_schedule write failed", e);
        return authedErr("DB_ERROR", 500);
      }
      return authedJson({ ok: true });
    }

async function handleStorageBoxesGet(ctx) {
  const { env, user, authedJson } = ctx;

      const { results: boxes } = await env.DB.prepare(
        "SELECT id, number, name, location, notes, created_by, created_at, edited_by, edited_at FROM storage_boxes WHERE list_id = ?1 ORDER BY number ASC"
      ).bind(user.list_id).all();
      const { results: items } = await env.DB.prepare(`
        SELECT sbi.box_id, sbi.name
        FROM storage_box_items sbi
        JOIN storage_boxes sb ON sb.id = sbi.box_id
        WHERE sb.list_id = ?1
        ORDER BY sbi.box_id ASC, sbi.position ASC
      `).bind(user.list_id).all();
      const itemsByBox = new Map();
      for (const it of items) {
        if (!itemsByBox.has(it.box_id)) itemsByBox.set(it.box_id, []);
        itemsByBox.get(it.box_id).push(it.name);
      }
      return authedJson(boxes.map((b) => ({ ...b, items: itemsByBox.get(b.id) || [] })));
    }

async function handleStorageBoxesPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      if (textTooLong(body.name, TEXT_LIMITS.boxName)
        || textTooLong(body.location, TEXT_LIMITS.boxLocation)
        || textTooLong(body.notes, TEXT_LIMITS.boxNotes)) {
        return authedErr("TEXT_TOO_LONG", 400);
      }
      const name = (body.name || "").trim();
      if (!name) return authedErr("STORAGE_BOX_NAME_REQUIRED", 400);
      const location = (body.location || "").trim();
      const notes = (body.notes || "").trim();
      const items = sanitizeStringArray(body.items, {
        maxLen: TEXT_LIMITS.boxItems, maxItemLen: TEXT_LIMITS.boxItem,
      });
      if (items === null) return authedErr("TOO_MANY_ENTRIES", 400);

      const { count: liveCount } = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM storage_boxes WHERE list_id = ?1"
      ).bind(user.list_id).first();
      if (liveCount >= STORAGE_BOX_CAP) return authedErr("STORAGE_BOX_LIMIT", 400);

      let number;
      if (body.claim_number !== undefined) {
        // A specific number the client asked for — either scanning a sticker
        // printed from a client-generated sequence/a deleted box's old
        // number, or someone just typing the number they want in the "new
        // box" form. Any positive integer is fair game as long as no *live*
        // box in this list currently holds it — there's no longer a counter
        // to bound it against (see CLAUDE.md's Storage module: number reuse
        // was a deliberate later reversal of the original
        // monotonic-never-reused design).
        const claimed = parseInt(body.claim_number, 10);
        const valid = Number.isInteger(claimed) && claimed >= 1 && claimed <= 999999999;
        const alreadyUsed = valid
          ? await env.DB.prepare("SELECT id FROM storage_boxes WHERE list_id = ?1 AND number = ?2").bind(user.list_id, claimed).first()
          : true;
        if (!valid || alreadyUsed) return authedErr("STORAGE_BOX_NUMBER_UNAVAILABLE", 400);
        number = claimed;
      } else {
        // Server allocates the number, never accepted from the request body:
        // the smallest positive integer not currently held by a live box in
        // this list — a deleted box's number is reused once nothing live
        // holds it.
        const allocated = await env.DB.prepare(`
          SELECT MIN(n) AS number FROM (
            SELECT 1 AS n
            UNION ALL
            SELECT number + 1 AS n FROM storage_boxes WHERE list_id = ?1
          ) c
          WHERE NOT EXISTS (SELECT 1 FROM storage_boxes b WHERE b.list_id = ?1 AND b.number = c.n)
        `).bind(user.list_id).first();
        number = allocated.number;
      }

      // A concurrent create landing on the same number (auto-allocate raced
      // by another request, or two people typing the same manual number at
      // once) trips storage_boxes' UNIQUE(list_id, number) — surfaced as a
      // clean "try again" rather than a 500, since a plain retry picks a
      // fresh smallest-available number.
      let box;
      try {
        box = await env.DB.prepare(`
          INSERT INTO storage_boxes (list_id, number, name, location, notes, created_by)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          RETURNING id, number, name, location, notes, created_by, created_at, edited_by, edited_at
        `).bind(user.list_id, number, name, location, notes, user.username).first();
      } catch {
        return authedErr("STORAGE_BOX_NUMBER_UNAVAILABLE", 400);
      }

      if (items.length) {
        await env.DB.batch(items.map((itemName, i) =>
          env.DB.prepare("INSERT INTO storage_box_items (box_id, name, position) VALUES (?1, ?2, ?3)")
            .bind(box.id, itemName, i)
        ));
      }
      return authedJson({ ...box, items });
    }

async function handleStorageBoxByNumber(ctx, cap1) {
  const { env, user, authedJson, authedErr } = ctx;
  const byNumberMatch = [null, cap1];

      const box = await env.DB.prepare(
        "SELECT id, number, name, location, notes, created_by, created_at, edited_by, edited_at FROM storage_boxes WHERE list_id = ?1 AND number = ?2"
      ).bind(user.list_id, Number(byNumberMatch[1])).first();
      if (!box) return authedErr("STORAGE_BOX_NOT_FOUND", 404);
      const { results: items } = await env.DB.prepare(
        "SELECT name FROM storage_box_items WHERE box_id = ?1 ORDER BY position ASC"
      ).bind(box.id).all();
      return authedJson({ ...box, items: items.map((i) => i.name) });
    }

async function handleStorageBoxPatch(ctx, cap1) {
  const { request, env, user, authedJson, authedErr } = ctx;
  const storageBoxIdMatch = [null, cap1];

      const boxId = Number(storageBoxIdMatch[1]);
      const existing = await env.DB.prepare(
        "SELECT id FROM storage_boxes WHERE id = ?1 AND list_id = ?2"
      ).bind(boxId, user.list_id).first();
      if (!existing) return authedErr("STORAGE_BOX_NOT_FOUND", 404);

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      if (textTooLong(body.name, TEXT_LIMITS.boxName)
        || textTooLong(body.location, TEXT_LIMITS.boxLocation)
        || textTooLong(body.notes, TEXT_LIMITS.boxNotes)) {
        return authedErr("TEXT_TOO_LONG", 400);
      }
      const name = (body.name || "").trim();
      if (!name) return authedErr("STORAGE_BOX_NAME_REQUIRED", 400);
      const location = (body.location || "").trim();
      const notes = (body.notes || "").trim();
      // Items replace wholesale — the list is small enough that diffing
      // isn't worth it (same reasoning as the doc's endpoint table).
      const items = sanitizeStringArray(body.items, {
        maxLen: TEXT_LIMITS.boxItems, maxItemLen: TEXT_LIMITS.boxItem,
      });
      if (items === null) return authedErr("TOO_MANY_ENTRIES", 400);

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE storage_boxes SET name = ?1, location = ?2, notes = ?3, edited_by = ?4, edited_at = datetime('now') WHERE id = ?5"
        ).bind(name, location, notes, user.username, boxId),
        env.DB.prepare("DELETE FROM storage_box_items WHERE box_id = ?1").bind(boxId),
        ...items.map((itemName, i) =>
          env.DB.prepare("INSERT INTO storage_box_items (box_id, name, position) VALUES (?1, ?2, ?3)")
            .bind(boxId, itemName, i)
        ),
      ]);
      return authedJson({ ok: true });
    }

async function handleStorageBoxDelete(ctx, cap1) {
  const { env, user, authedJson, authedErr } = ctx;
  const storageBoxIdMatch = [null, cap1];

      const boxId = Number(storageBoxIdMatch[1]);
      const result = await env.DB.prepare(
        "DELETE FROM storage_boxes WHERE id = ?1 AND list_id = ?2"
      ).bind(boxId, user.list_id).run();
      if (!result.meta.changes) return authedErr("STORAGE_BOX_NOT_FOUND", 404);
      return authedJson({ ok: true });
    }

async function handlePushVapidPublicKey(ctx) {
  const { env, authedJson } = ctx;

      return authedJson({ publicKey: env.VAPID_PUBLIC_KEY || null });
    }

async function handlePushSubscribe(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
        return authedErr("INVALID_SUBSCRIPTION", 400);
      }
      // The reminder columns (meal/weekly enabled+time) are per-device and
      // intentionally NOT touched here: on first insert they take their
      // DEFAULTs (enabled, 18:00 — matching the cron's fallback), and on an
      // upsert (a re-subscribe / PushContext refresh) they're preserved so a
      // device keeps whatever reminder preferences it had.
      await env.DB.prepare(`
        INSERT INTO push_subscriptions (endpoint, username, list_id, p256dh, auth)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(endpoint) DO UPDATE SET
          username = excluded.username, list_id = excluded.list_id,
          p256dh = excluded.p256dh, auth = excluded.auth, updated_at = datetime('now')
      `).bind(body.endpoint, user.username, user.list_id, body.keys.p256dh, body.keys.auth).run();
      return authedJson({ ok: true });
    }

async function handlePushUnsubscribe(ctx) {
  const { request, env, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body?.endpoint) return authedErr("INVALID_REQUEST", 400);
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1")
        .bind(body.endpoint).run();
      return authedJson({ ok: true });
    }

async function handleNotificationSettingsGet(ctx) {
  const { env, user, authedJson } = ctx;

      const row = await env.DB.prepare(
        "SELECT stale_item_days FROM notification_settings WHERE list_id = ?1"
      ).bind(user.list_id).first();
      return authedJson({
        stale_item_days: row?.stale_item_days ?? 7,
      });
    }

async function handleNotificationSettingsPost(ctx) {
  const { request, env, path, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const staleItemDays = Number(body.stale_item_days);
      if (!Number.isInteger(staleItemDays) || staleItemDays < STALE_ITEM_DAYS_MIN || staleItemDays > STALE_ITEM_DAYS_MAX) {
        return authedErr("INVALID_DAY_COUNT", 400);
      }
      // Only stale_item_days is written; the reminder columns still exist on
      // this table (expand/contract — not yet dropped) but are no longer read
      // or written by any code path.
      await env.DB.prepare(`
        INSERT INTO notification_settings (list_id, stale_item_days)
        VALUES (?1, ?2)
        ON CONFLICT(list_id) DO UPDATE SET
          stale_item_days = excluded.stale_item_days,
          updated_at = datetime('now')
      `).bind(user.list_id, staleItemDays).run();
      return authedJson({ ok: true });
    }

async function handlePushReminderSettingsGet(ctx) {
  const { env, url, user, authedJson } = ctx;

      const endpoint = url.searchParams.get("endpoint") || "";
      const row = endpoint
        ? await env.DB.prepare(
            "SELECT meal_reminder_enabled, meal_reminder_time, weekly_reminder_enabled, weekly_reminder_time FROM push_subscriptions WHERE endpoint = ?1 AND list_id = ?2"
          ).bind(endpoint, user.list_id).first()
        : null;
      return authedJson({
        meal_reminder_enabled: row ? !!row.meal_reminder_enabled : true,
        meal_reminder_time: row?.meal_reminder_time || "18:00",
        weekly_reminder_enabled: row ? !!row.weekly_reminder_enabled : true,
        weekly_reminder_time: row?.weekly_reminder_time || "18:00",
      });
    }

async function handlePushReminderSettingsPost(ctx) {
  const { request, env, user, authedJson, authedErr } = ctx;

      const body = await readJson(request);
      if (!body?.endpoint) return authedErr("INVALID_REQUEST", 400);
      // 15-minute increments only, matching the cron's check granularity —
      // any other value would just never fire.
      if (!REMINDER_TIME_RE.test(body.meal_reminder_time || "")) {
        return authedErr("INVALID_TIME", 400);
      }
      if (!REMINDER_TIME_RE.test(body.weekly_reminder_time || "")) {
        return authedErr("INVALID_TIME", 400);
      }
      // Updates only this device's own subscription row (scoped to the
      // caller's list). A no-op if the device isn't subscribed — the
      // frontend only surfaces these controls once push is enabled.
      const res = await env.DB.prepare(`
        UPDATE push_subscriptions SET
          meal_reminder_enabled = ?1, meal_reminder_time = ?2,
          weekly_reminder_enabled = ?3, weekly_reminder_time = ?4,
          updated_at = datetime('now')
        WHERE endpoint = ?5 AND list_id = ?6
      `).bind(
        body.meal_reminder_enabled ? 1 : 0, body.meal_reminder_time,
        body.weekly_reminder_enabled ? 1 : 0, body.weekly_reminder_time,
        body.endpoint, user.list_id
      ).run();
      if (res.meta.changes === 0) {
        return authedErr("NO_ACTIVE_SUBSCRIPTION", 404);
      }
      return authedJson({ ok: true });
    }

async function handlePushPing(ctx) {
  const { env, url, user, authedJson, authedErr } = ctx;

      // SQL-side comparison (not JS Date parsing) to match this codebase's
      // existing convention for TEXT datetime('now') columns (e.g. meal_plan
      // pruning's `plan_date < date('now', '-14 days')`).
      const recent = await env.DB.prepare(
        "SELECT 1 FROM notification_state WHERE list_id = ?1 AND type = 'ping' AND last_notified_at > datetime('now', '-2 minutes')"
      ).bind(user.list_id).first();
      if (recent) {
        return authedErr("PING_COOLDOWN", 429);
      }
      await env.DB.prepare(`
        INSERT INTO notification_state (list_id, type, last_notified_at) VALUES (?1, 'ping', datetime('now'))
        ON CONFLICT(list_id, type) DO UPDATE SET last_notified_at = excluded.last_notified_at
      `).bind(user.list_id).run();

      const caller = await env.DB.prepare(
        "SELECT name FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      const callerName = caller?.name || user.username;
      await sendPushToList(env, user.list_id, {
        title: "Panhandle",
        body: `${callerName} trenger oppmerksomheten din`,
        url: "/app.html",
      }, { excludeUsernames: [user.username] });
      return authedJson({ ok: true });
    }

const PUBLIC_ROUTES = [
  { method: "GET", path: "/version", handler: handleVersion },
  { method: "POST", path: "/login", handler: handleLogin },
  { method: "POST", path: "/register", handler: handleRegister },
  { method: "POST", path: "/auth/google", handler: handleAuthGoogle },
  { method: "POST", path: "/forgot-password", handler: handleForgotPassword },
  { method: "POST", path: "/reset-password", handler: handleResetPassword },
  { method: "GET", pattern: LIST_INVITE_PATTERN, handler: handleListInvitePreview },
  { method: "POST", path: "/invite-signup", handler: handleInviteSignup },
  { method: "POST", path: "/invite-google", handler: handleInviteGoogle },
  { method: "GET", pattern: CALENDAR_FEED_PATTERN, handler: handleCalendarFeedIcs },
];

const AUTHENTICATED_ROUTES = [
  { method: "POST", path: "/change-password", handler: handleChangePassword },
  { method: "GET", path: "/account", handler: handleAccountGet },
  { method: "POST", path: "/change-name", handler: handleChangeName },
  { method: "POST", path: "/change-email", handler: handleChangeEmail },
  { method: "DELETE", path: "/account", handler: handleAccountDelete },
  { method: "POST", path: "/feedback", handler: handleFeedback },
  { method: "POST", path: "/admin/owners", handler: handleAdminOwnersPost },
  { method: "GET", path: "/admin/users", handler: handleAdminUsersGet },
  { method: "POST", pattern: ADMIN_RESET_PASSWORD_PATTERN, handler: handleAdminUserResetPassword },
  { method: "PATCH", pattern: ADMIN_FLAGS_PATTERN, handler: handleAdminUserFlags },
  { method: "DELETE", pattern: ADMIN_USER_ID_PATTERN, handler: handleAdminUserDelete },
  { method: "GET", path: "/admin/metrics", handler: handleAdminMetrics },
  { method: "GET", path: "/list-users", handler: handleListUsersGet },
  { method: "POST", path: "/list-users", handler: handleListUsersPost },
  { method: "DELETE", pattern: LIST_USER_ID_PATTERN, handler: handleListUserDelete },
  { method: "GET", path: "/list-invites", handler: handleListInvitesGet },
  { method: "POST", path: "/list-invites", handler: handleListInvitesPost },
  { method: "DELETE", path: "/list-invites", handler: handleListInvitesDelete },
  { method: "GET", path: "/calendar-feed", handler: handleCalendarFeedSettingsGet },
  { method: "POST", path: "/calendar-feed", handler: handleCalendarFeedSettingsPost },
  { method: "POST", path: "/calendar-feed/token", handler: handleCalendarFeedTokenPost },
  { method: "DELETE", path: "/calendar-feed/token", handler: handleCalendarFeedTokenDelete },
  { method: "POST", path: "/presence", handler: handlePresence },
  { method: "GET", path: "/list", handler: handleListGet },
  { method: "POST", path: "/list", handler: handleListPost },
  { method: "POST", path: "/list/mark-all-bought", handler: handleListMarkAllBought },
  { method: "PATCH", pattern: LIST_ITEM_ID_PATTERN, handler: handleListItemPatch },
  { method: "DELETE", pattern: LIST_ITEM_CATALOGUE_PATTERN, handler: handleListItemCatalogueDelete },
  { method: "POST", pattern: LIST_ITEM_TOGGLE_PATTERN, handler: handleListItemToggle },
  { method: "DELETE", pattern: LIST_ITEM_ID_PATTERN, handler: handleListItemDelete },
  { method: "GET", path: "/catalogue", handler: handleCatalogueGet },
  { method: "GET", path: "/catalogue/suggestions", handler: handleCatalogueSuggestions },
  { method: "GET", path: "/category-order", handler: handleCategoryOrderGet },
  { method: "POST", path: "/category-order", handler: handleCategoryOrderPost },
  { method: "POST", path: "/recipe-import", handler: handleRecipeImport },
  { method: "GET", path: "/meals", handler: handleMealsGet },
  { method: "GET", path: "/meals/suggestions", handler: handleMealsSuggestions },
  { method: "POST", path: "/meals", handler: handleMealsPost },
  { method: "PATCH", pattern: MEAL_ID_PATTERN, handler: handleMealPatch },
  { method: "DELETE", pattern: MEAL_ID_PATTERN, handler: handleMealDelete },
  { method: "GET", path: "/plan", handler: handlePlanGet },
  { method: "POST", path: "/plan", handler: handlePlanPost },
  { method: "DELETE", pattern: PLAN_DATE_PATTERN, handler: handlePlanDelete },
  { method: "GET", path: "/recurring", handler: handleRecurringGet },
  { method: "POST", path: "/recurring", handler: handleRecurringPost },
  { method: "GET", path: "/storage/boxes", handler: handleStorageBoxesGet },
  { method: "POST", path: "/storage/boxes", handler: handleStorageBoxesPost },
  { method: "GET", pattern: STORAGE_BOX_BY_NUMBER_PATTERN, handler: handleStorageBoxByNumber },
  { method: "PATCH", pattern: STORAGE_BOX_ID_PATTERN, handler: handleStorageBoxPatch },
  { method: "DELETE", pattern: STORAGE_BOX_ID_PATTERN, handler: handleStorageBoxDelete },
  { method: "GET", path: "/push/vapid-public-key", handler: handlePushVapidPublicKey },
  { method: "POST", path: "/push/subscribe", handler: handlePushSubscribe },
  { method: "DELETE", path: "/push/subscribe", handler: handlePushUnsubscribe },
  { method: "GET", path: "/notification-settings", handler: handleNotificationSettingsGet },
  { method: "POST", path: "/notification-settings", handler: handleNotificationSettingsPost },
  { method: "GET", path: "/push/reminder-settings", handler: handlePushReminderSettingsGet },
  { method: "POST", path: "/push/reminder-settings", handler: handlePushReminderSettingsPost },
  { method: "POST", path: "/push/ping", handler: handlePushPing },
];

const worker = {
  // Thin outer wrapper around `route` below, which holds the actual routing.
  // Nothing previously caught a throw from a handler: an unexpected error
  // (a D1 failure, a malformed row, a typo on a rare branch) surfaced as the
  // runtime's own opaque 500 and was never recorded anywhere, so a broken
  // endpoint could stay broken silently. Everything now funnels through here,
  // which logs the method + path + error (readable via `wrangler tail`, or a
  // Logpush job) and answers with a plain SERVER_ERROR — never the underlying
  // message, which can carry schema internals (see the DB_ERROR handler in
  // /recurring for the same reasoning).
  async fetch(request, env) {
    try {
      return await worker.route(request, env);
    } catch (e) {
      let pathname = "?";
      try { pathname = new URL(request.url).pathname; } catch { /* unparseable URL */ }
      console.error("Unhandled error", request.method, pathname, e?.stack || e);
      return err("SERVER_ERROR", 500);
    }
  },

  async route(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ===== ROUTING =====
    // shopping.mohibb.com is the legacy personal domain (still attached to
    // this Worker as a Custom Domain — see wrangler.toml's comment and
    // docs/android-publishing.md's cutover checklist item 6, which left it
    // in place rather than removing it outright). Every request there now
    // 301s to the same path on panhandle.app instead: panhandle.app's own
    // /app.html redirect below chains this on to shop.panhandle.app for app
    // requests, while any other path (e.g. the bare root) lands on the
    // marketing page. Gated strictly on this exact hostname, matching the
    // same strict-hostname convention as every other redirect in this
    // section, for the same reason (a Cloudflare branch/commit preview's own
    // hostname is never redirected away from itself).
    if (url.hostname === "shopping.mohibb.com") {
      const target = new URL(url.pathname + url.search, "https://panhandle.app");
      return Response.redirect(target.toString(), 301);
    }

    // panhandle.app is the marketing landing page's home; the app itself now
    // lives at shop.panhandle.app (see wrangler.toml's APP_ORIGIN comment).
    // Gated strictly on the apex hostname — never on "isn't shop.panhandle.app"
    // — so a Cloudflare branch/commit preview's own hostname (which also
    // serves /app.html for click-testing, see CLAUDE.md's testing
    // conventions) is never redirected away from itself.
    // Path is normalized (collapse repeated slashes, drop a trailing slash)
    // before matching "/app.html"/"/app", since Cloudflare Pages also serves
    // the app at its .html-stripped canonical path ("/app") and at
    // slash-variant paths — matching the literal string "/app.html" alone
    // let all of those slip through and serve the app on the wrong domain.
    const normalizedPath = url.pathname.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
    if (url.hostname === "panhandle.app" && (normalizedPath === "/app.html" || normalizedPath === "/app")) {
      const target = new URL("/app.html" + url.search, "https://shop.panhandle.app");
      return Response.redirect(target.toString(), 301);
    }

    // shop.panhandle.app's bare root already serves the app with a clean URL
    // (see the proxy branch below), but nothing previously sent a visitor
    // landing directly on /app.html or /app (an old bookmark, a saved PWA
    // shortcut, browser autocomplete from before the root started serving
    // the app) back to that clean root — the proxy below just served the
    // content in place, leaving the path visible forever. Gated strictly on
    // this exact hostname so a Cloudflare branch/commit preview's own
    // hostname keeps using /app.html for click-testing (see CLAUDE.md's
    // testing conventions).
    if (url.hostname === "shop.panhandle.app" && (normalizedPath === "/app.html" || normalizedPath === "/app")) {
      const target = new URL("/" + url.search, url.origin);
      return Response.redirect(target.toString(), 301);
    }

    const isApi = url.pathname.startsWith("/api");
    if (!isApi) {
      const pagesUrl = new URL(request.url);
      pagesUrl.hostname = "panhandle-ecj.pages.dev";
      // shop.panhandle.app's bare root is the app's own dedicated address, so
      // it serves app.html directly — rewritten (proxied), not redirected, so
      // the URL bar stays shop.panhandle.app with no visible /app.html.
      // Gated strictly on this exact hostname so a Cloudflare branch/commit
      // preview's own hostname keeps using /app.html for click-testing (see
      // CLAUDE.md's testing conventions).
      if (url.hostname === "shop.panhandle.app" && url.pathname === "/") {
        pagesUrl.pathname = "/app.html";
      }
      // The storage module's QR/deep-link route (docs/storage-module-plan.md):
      // a scanned box's sticker encodes .../b/{number}, and the app itself
      // has to be loaded (app.html) before it can read that path and open
      // the box (see App.jsx's pendingBoxNumber). Unlike the "/" rewrite
      // above, this is NOT hostname-gated — there's no static content
      // (public/ has no "b" directory) at this path on any hostname to
      // collide with, so a branch/commit preview's own generated deep links
      // (built from window.location.origin, whatever that preview's host
      // is) work for click-testing too, the same as everywhere else.
      if (/^\/b\/\d+$/.test(url.pathname)) {
        pagesUrl.pathname = "/app.html";
      }
      // Cloudflare Pages auto-redirects a request for "*.html" to the
      // extension-less canonical path (e.g. /app.html -> /app). The incoming
      // request's redirect mode defaults to "manual", so without forcing
      // "follow" here that upstream redirect passed straight through to the
      // browser — whose relative Location then resolved against this
      // Worker's own hostname, landing users on an unwanted .../app.
      // Following it here keeps that Pages implementation detail invisible:
      // the client only ever sees the URL it actually requested.
      const upstream = await fetch(new Request(pagesUrl.toString(), request), { redirect: "follow" });
      return withSecurityHeaders(upstream);
    }

    const path = url.pathname.replace(/^\/api/, "");

    const baseCtx = { request, env, url, path, method };
    const pub = matchRoute(PUBLIC_ROUTES, method, path);
    if (pub) return await pub.handler(baseCtx, ...pub.params);


    // ===== AUTH REQUIRED BELOW =====
    const user = await requireAuth(request, env);
    if (!user) return err("UNAUTHORIZED", 401);
    const freshToken = await mintToken(user, env);
    // Sliding expiry: every authenticated response carries a freshly-minted
    // token so the session is extended no matter which endpoint is used (not
    // just /list). /change-password is the exception — it returns the
    // authoritative new-version token in its body, and the frontend ignores
    // this header on that path.
    const authedJson = (data, status = 200, extra = {}) =>
      json(data, status, { "X-Refresh-Token": freshToken, ...extra });
    // Error counterpart — same refresh-token header, err()'s { error, code } body.
    const authedErr = (code, status = 400, opts = {}) =>
      err(code, status, { ...opts, extra: { "X-Refresh-Token": freshToken, ...(opts.extra || {}) } });

    const authedCtx = { ...baseCtx, user, freshToken, authedJson, authedErr };
    const authed = matchRoute(AUTHENTICATED_ROUTES, method, path);
    if (authed) return await authed.handler(authedCtx, ...authed.params);
    return authedErr("NOT_FOUND", 404);
  },

  // Cron-driven (see [triggers] in wrangler.toml). Thin wrapper so the actual
  // logic (runNotificationPass / checkCatalogueSync, above) stays
  // independently callable/testable. The two checks are unrelated concerns
  // (notifications vs. catalogue rollout) run as separate waitUntil tasks
  // rather than bundled into one function.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runNotificationPass(env, event.scheduledTime));
    ctx.waitUntil(checkCatalogueSync(env));
  },
};

export default worker;
