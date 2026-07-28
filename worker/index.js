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
export function sanitizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of labels) {
    const clean = capitalizeName(typeof raw === "string" ? raw : "");
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
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

// Username is a by-value copy — not a foreign key — inside list_items.added_by,
// meal_plan.responsible, recurring_schedule.responsible, users.created_by,
// password_resets.username, and push_subscriptions.username (see TODO #17),
// so renaming it means updating every one of those alongside the users row
// itself, in one batch so they can't drift apart. Callers must mint a fresh
// token afterward — the caller's existing JWT's `sub` now points at a row
// that no longer exists.
async function renameUsername(env, oldUsername, newUsername) {
  await env.DB.batch([
    env.DB.prepare("UPDATE list_items SET added_by = ?1 WHERE added_by = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE meal_plan SET responsible = ?1 WHERE responsible = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE recurring_schedule SET responsible = ?1 WHERE responsible = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE users SET created_by = ?1 WHERE created_by = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE password_resets SET username = ?1 WHERE username = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE push_subscriptions SET username = ?1 WHERE username = ?2").bind(newUsername, oldUsername),
    env.DB.prepare("UPDATE users SET username = ?1, email = ?1 WHERE username = ?2 COLLATE NOCASE").bind(newUsername, oldUsername),
  ]);
}

// Site-wide metrics (across every list) are gated beyond ordinary is_admin
// (which is deliberately per-list) via this env var — a comma-separated
// allowlist of usernames, set as a Worker dashboard variable alongside
// JWT_SECRET, never committed.
export function isSuperAdmin(username, env) {
  const allowed = (env.SUPERADMIN_USERNAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes((username || "").toLowerCase());
}

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ===== ROUTING =====
    // panhandle.app is the marketing landing page's home; the app itself now
    // lives at shop.panhandle.app (see wrangler.toml's APP_ORIGIN comment).
    // Gated strictly on the apex hostname — never on "isn't shop.panhandle.app"
    // — so a Cloudflare branch/commit preview's own hostname (which also
    // serves /app.html for click-testing, see CLAUDE.md's testing
    // conventions) is never redirected away from itself.
    if (url.hostname === "panhandle.app" && url.pathname === "/app.html") {
      const target = new URL(url.pathname + url.search, "https://shop.panhandle.app");
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
      // Cloudflare Pages auto-redirects a request for "*.html" to the
      // extension-less canonical path (e.g. /app.html -> /app). The incoming
      // request's redirect mode defaults to "manual", so without forcing
      // "follow" here that upstream redirect passed straight through to the
      // browser — whose relative Location then resolved against this
      // Worker's own hostname, landing users on an unwanted .../app.
      // Following it here keeps that Pages implementation detail invisible:
      // the client only ever sees the URL it actually requested.
      return fetch(new Request(pagesUrl.toString(), request), { redirect: "follow" });
    }

    const path = url.pathname.replace(/^\/api/, "");

    // ===== VERSION (public, unauthenticated) =====
    // Cheap deploy-confirmation probe: lets the frontend (and a curl) read the
    // live Worker version without a token.
    if (path === "/version" && method === "GET") {
      return json({ version: VERSION });
    }

    // ===== LOGIN =====
    if (path === "/login" && method === "POST") {
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

    // ===== REGISTER (public, self-service signup) =====
    // Creates a brand-new household: a fresh list (optionally named) plus its
    // first owner account. Open to anyone — gated by Turnstile + an IP rate
    // limit instead of an invite code, since any signed-up member of an
    // existing household is added by its owner via POST /list-users instead.
    if (path === "/register" && method === "POST") {
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

    // ===== SIGN IN WITH GOOGLE (public) =====
    // Accepts the ID-token JWT from Google's client-side sign-in button.
    // Logs in an existing account (matched by google_sub, or by email if this
    // is that account's first time using Google), or creates a brand-new
    // household the same way /register does. Google's own sign-in flow is
    // already strong bot resistance, so account creation here skips Turnstile
    // but still shares /register's rate-limit bucket.
    if (path === "/auth/google" && method === "POST") {
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

    // ===== FORGOT PASSWORD (public) =====
    if (path === "/forgot-password" && method === "POST") {
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

      const resetUrl = `${env.APP_ORIGIN || "https://shop.panhandle.app"}/app.html?reset_token=${rawToken}`;
      await sendEmail(env, {
        to: cleanEmail,
        subject: "Tilbakestill passordet ditt - Panhandle",
        html: `<p>Klikk her for å tilbakestille passordet ditt (lenken er gyldig i 30 minutter):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Hvis du ikke ba om dette, kan du ignorere denne e-posten.</p>`,
      });
      return genericOk;
    }

    // ===== RESET PASSWORD (public) =====
    if (path === "/reset-password" && method === "POST") {
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

    // ===== CHANGE PASSWORD =====
    if (path === "/change-password" && method === "POST") {
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

    // ===== ACCOUNT (name/email; email doubles as username, see TODO #17) =====
    if (path === "/account" && method === "GET") {
      const row = await env.DB.prepare(
        "SELECT email, name FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      return authedJson({ email: row.email || null, name: row.name || user.username, username: user.username });
    }

    // Display name only — unlike email/password, this isn't security-sensitive
    // (not used to log in or recover the account), so no current_password
    // check is required.
    if (path === "/change-name" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const cleanName = sanitizeDisplayName(body.name);
      if (!cleanName) return authedErr("ENTER_NAME", 400);
      await env.DB.prepare("UPDATE users SET name = ?1 WHERE username = ?2 COLLATE NOCASE")
        .bind(cleanName, user.username).run();
      return authedJson({ ok: true, name: cleanName });
    }

    if (path === "/change-email" && method === "POST") {
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

    // Self-service account deletion (phase 1 of TODO's account-lifecycle
    // item — still one list per user, so this only ever removes/replaces the
    // caller's own household, never leaves them list-less). A non-owner just
    // leaves; an owner who isn't the list's last owner does the same. The
    // list's last owner deleting their account cascade-deletes the entire
    // list (every other member included) rather than being refused like
    // DELETE /list-users and PATCH /flags do — there's no "reassign
    // ownership" flow yet, and blocking self-deletion entirely would leave
    // solo/last-owner accounts with no way to close their account at all.
    if (path === "/account" && method === "DELETE") {
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

    // ===== FEEDBACK =====
    // Emails env.FEEDBACK_EMAIL via the same Resend integration /forgot-password
    // uses — a Worker dashboard variable, set up manually post-deploy like
    // RESEND_API_KEY/TURNSTILE_SECRET_KEY (see CLAUDE.md), not committed. No
    // ticketing system needed for a 2-person app; this just closes the loop.
    if (path === "/feedback" && method === "POST") {
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

    // ===== ADMIN ENDPOINTS (require is_admin) =====
    // Create a new owner + their own list, seeded with COMMON_ITEMS. Minting
    // a brand-new household is an app-operator action (there's no caller
    // list to scope it against), so it's double-gated by isSuperAdmin like
    // /admin/metrics and DELETE /admin/users/{u} below.
    if (path === "/admin/owners" && method === "POST") {
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

    // Every user in the caller's own list with their flags — unless the
    // caller is superadmin, who sees every user in every list (needed for
    // the admin console's cross-household view).
    if (path === "/admin/users" && method === "GET") {
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

    // Reset any user's password (recovery path). Bumps token_version.
    // Scoped to the caller's own list unless the caller is superadmin.
    // Cross-list targets 404 (rather than 403) to avoid revealing another
    // household's usernames. A superadmin account can never be reset by a
    // non-superadmin, even within the same list — the direct fix for TODO
    // #90's "reset the superadmin's password" escalation path.
    const rpMatch = path.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
    if (rpMatch && method === "POST") {
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

    // Set is_admin / is_owner flags independently. Bumps token_version.
    // Same list-scoping and superadmin-target guard as reset-password above.
    const flagMatch = path.match(/^\/admin\/users\/([^/]+)\/flags$/);
    if (flagMatch && method === "PATCH") {
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

    // Delete any user account outright — gated beyond ordinary is_admin by
    // isSuperAdmin (same double-gate as /admin/metrics), since this is a much
    // more consequential operation than the other admin endpoints, which only
    // ever demote/reset/remove-from-one-list rather than deleting a row.
    // Still refuses (doesn't cascade) if the target is the last admin —
    // there's no list to cascade into for that case, mirroring PATCH
    // .../flags's guard exactly, so the superadmin promotes someone else
    // first, same as any other admin already has to.
    // If the target is a list's last owner, deleting them would otherwise hit
    // the same "eneste eier" guard — but here (unlike PATCH .../flags and
    // DELETE /list-users, which only ever demote/remove-from-list) there's no
    // "leave the list ownerless" outcome to protect against: the caller can
    // choose to cascade-delete the entire list along with the user, same as
    // DELETE /account does for a self-deleting last owner. That's a much
    // bigger blast radius than an ordinary user deletion, so it's opt-in via
    // body.delete_list — the frontend shows an explicit extra warning first
    // and only then resends the request with that flag set.
    const adminDelMatch = path.match(/^\/admin\/users\/([^/]+)$/);
    if (adminDelMatch && method === "DELETE") {
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

    // Site-wide usage metrics, across all lists (not just the caller's own).
    // Gated beyond is_admin by isSuperAdmin — see its definition above.
    if (path === "/admin/metrics" && method === "GET") {
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

    // ===== LIST-USER ENDPOINTS =====
    // Members of the caller's own list. Readable by any authed user on the
    // list (used to populate the meal-responsible dropdown).
    if (path === "/list-users" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT username, name, is_admin, is_owner FROM users WHERE list_id = ?1 ORDER BY username"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // Add a plain member to the caller's list (owner only). Capped at 10.
    if (path === "/list-users" && method === "POST") {
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

    // Remove a member from the caller's list (owner only).
    const luDelMatch = path.match(/^\/list-users\/([^/]+)$/);
    if (luDelMatch && method === "DELETE") {
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

    // ===== PRESENCE =====
    // Heartbeat called alongside the shopping list poll (see POLL_MS in
    // ShoppingListTab) so members can see who else currently has the list
    // open — an upsert-per-poll rather than tracked connection state, so a
    // closed tab or dropped connection just stops refreshing and silently
    // ages out of the "active" window below.
    if (path === "/presence" && method === "POST") {
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

    // ===== SHOPPING LIST (all queries scoped to user.list_id) =====
    if (path === "/list" && method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT li.id, li.bought, li.important, li.added_by, li.added_at, li.bought_at, li.qty, li.notes, c.name, c.category
        FROM list_items li
        JOIN item_catalogue c ON c.id = li.catalogue_id
        WHERE li.list_id = ?1
        ORDER BY li.bought ASC, c.category ASC, c.name ASC
      `).bind(user.list_id).all();
      return authedJson(results);
    }

    if (path === "/list" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { name, category, notes, qty, exact } = body;
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
      const inserted = await env.DB.prepare(
        "INSERT INTO list_items (catalogue_id, added_by, notes, qty, list_id) VALUES (?1, ?2, ?3, ?4, ?5)"
      ).bind(cat.id, user.username, noteVal, addQty, user.list_id).run();
      return authedJson({ ok: true, qty: addQty, id: inserted.meta.last_row_id });
    }

    // End-of-trip sweep (TODO #100): drop every bought line at once instead of
    // clearing them one at a time from the "Recently bought" palette. Only touches
    // list_items — the item_catalogue rows (and their durable purchase stats)
    // stay, so suggestions and re-adding are unaffected. Placed before the
    // /list/:id regex handlers below, though "bought" wouldn't match \d+ anyway.
    if (path === "/list/bought" && method === "DELETE") {
      const res = await env.DB.prepare(
        "DELETE FROM list_items WHERE list_id = ?1 AND bought = 1"
      ).bind(user.list_id).run();
      return authedJson({ ok: true, cleared: res.meta?.changes ?? 0 });
    }

    const patchMatch = path.match(/^\/list\/(\d+)$/);
    if (patchMatch && method === "PATCH") {
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { qty, notes, category, name, important } = body;
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(patchMatch[1], user.list_id).first();
      if (!row) return authedErr("ITEM_NOT_FOUND", 404);
      if (important !== undefined) {
        await env.DB.prepare("UPDATE list_items SET important = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(important ? 1 : 0, patchMatch[1], user.list_id).run();
      }
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
      return authedJson({ ok: true });
    }

    // Deletes the catalogue entry entirely (not just this list_items row) —
    // cascades to every list_items row referencing it via the FK, removing the
    // item from past/present lists, not just hiding this one occurrence.
    const delCatMatch = path.match(/^\/list\/(\d+)\/catalogue$/);
    if (delCatMatch && method === "DELETE") {
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(delCatMatch[1], user.list_id).first();
      if (!row) return authedErr("ITEM_NOT_FOUND", 404);
      await env.DB.prepare("DELETE FROM item_catalogue WHERE id = ?1 AND list_id = ?2")
        .bind(row.catalogue_id, user.list_id).run();
      return authedJson({ ok: true });
    }

    const toggleMatch = path.match(/^\/list\/(\d+)\/toggle$/);
    if (toggleMatch && method === "POST") {
      const item = await env.DB.prepare(
        "SELECT bought, catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(toggleMatch[1], user.list_id).first();
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
      if (item && item.bought === 0) {
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

    const delMatch = path.match(/^\/list\/(\d+)$/);
    if (delMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM list_items WHERE id = ?1 AND list_id = ?2")
        .bind(delMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    if (path === "/catalogue" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT name, category FROM item_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // Items worth nudging the user about: bought often enough (>=2 times) to
    // have a reliable average gap between purchases, not already sitting
    // unbought on the list, and at least that average gap overdue. Lifetime
    // stats live on item_catalogue (see 0005_item_purchase_stats.sql) since
    // list_items loses bought_at the moment an item is toggled back off.
    if (path === "/catalogue/suggestions" && method === "GET") {
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

    // Per-list custom aisle order (TODO #105) — a shared household setting,
    // same permission level as /recurring (any list member, not owner-gated),
    // since it's the household's store layout, not a per-device preference.
    // GET always returns a complete, valid ordering: stored positions merged
    // with any not-yet-placed categories (normalizeCategoryOrder), so a list
    // that never customised falls back to the canonical CATEGORIES order.
    if (path === "/category-order" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT category FROM category_order WHERE list_id = ?1 ORDER BY position ASC"
      ).bind(user.list_id).all();
      return authedJson({ order: normalizeCategoryOrder(results.map((r) => r.category)) });
    }

    if (path === "/category-order" && method === "POST") {
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

    // ===== MEALS =====
    if (path === "/meals" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, ingredients, labels, times_planned, last_planned FROM meal_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // Meals worth suggesting when planning a day: ones eaten often but not
    // recently (a 10-day cooldown), ranked by frequency first and staleness
    // second. Lifetime stats live on meal_catalogue (see 0004_meal_usage_stats.sql)
    // since meal_plan itself is pruned after 14 days.
    if (path === "/meals/suggestions" && method === "GET") {
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

    // Adds a brand-new meal to the catalogue directly (no day assignment) —
    // the editor view's "+ Nytt måltid", as opposed to /plan's implicit
    // create-on-first-use. Rejects a name that already exists so the editor
    // doesn't silently merge into an existing meal's row.
    if (path === "/meals" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const clean = capitalizeName(body.name);
      if (!clean) return authedErr("EMPTY_NAME", 400);
      const ingredientsJson = JSON.stringify(Array.isArray(body.ingredients) ? body.ingredients : []);
      const labelsJson = JSON.stringify(sanitizeLabels(body.labels));
      const clash = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
      ).bind(clean, user.list_id).first();
      if (clash) return authedErr("MEAL_NAME_EXISTS", 400);
      const meal = await env.DB.prepare(
        "INSERT INTO meal_catalogue (name, list_id, ingredients, labels) VALUES (?1, ?2, ?3, ?4) RETURNING id"
      ).bind(clean, user.list_id, ingredientsJson, labelsJson).first();
      return authedJson({ ok: true, id: meal.id });
    }

    const mealPatchMatch = path.match(/^\/meals\/(\d+)$/);
    if (mealPatchMatch && method === "PATCH") {
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const meal = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE id = ?1 AND list_id = ?2"
      ).bind(mealPatchMatch[1], user.list_id).first();
      if (!meal) return authedErr("MEAL_NOT_FOUND", 404);
      if (body.name !== undefined) {
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
        const ingredientsJson = JSON.stringify(Array.isArray(body.ingredients) ? body.ingredients : []);
        await env.DB.prepare("UPDATE meal_catalogue SET ingredients = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(ingredientsJson, meal.id, user.list_id).run();
      }
      if (body.labels !== undefined) {
        const labelsJson = JSON.stringify(sanitizeLabels(body.labels));
        await env.DB.prepare("UPDATE meal_catalogue SET labels = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(labelsJson, meal.id, user.list_id).run();
      }
      return authedJson({ ok: true });
    }

    // Deletes the meal entirely from the catalogue. meal_plan.meal_id is
    // ON DELETE SET NULL (see migrations/0009_meal_plan_set_null.sql), so any
    // day currently assigned this meal reverts to unplanned but keeps its
    // plan_date/responsible — unlike item_catalogue's cascade delete, this
    // doesn't drop the row itself.
    const mealDelMatch = path.match(/^\/meals\/(\d+)$/);
    if (mealDelMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM meal_catalogue WHERE id = ?1 AND list_id = ?2")
        .bind(mealDelMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    if (path === "/plan" && method === "GET") {
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

    if (path === "/plan" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { plan_date, meal_name, responsible, ingredients } = body;
      if (!plan_date || !/^\d{4}-\d{2}-\d{2}$/.test(plan_date)) {
        return authedErr("INVALID_DATE", 400);
      }
      // Require at least one of meal_name or responsible to be set.
      if (!meal_name && !responsible) return authedErr("MISSING_MEAL_OR_RESPONSIBLE", 400);

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
          const ingredientsJson = Array.isArray(ingredients) ? JSON.stringify(ingredients) : undefined;
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

    const planDelMatch = path.match(/^\/plan\/(\d{4}-\d{2}-\d{2})$/);
    if (planDelMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM meal_plan WHERE plan_date = ?1 AND list_id = ?2")
        .bind(planDelMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    if (path === "/recurring" && method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT day_of_week, responsible FROM recurring_schedule WHERE list_id = ?1 ORDER BY day_of_week"
      ).bind(user.list_id).all();
      return authedJson(rows.results);
    }

    if (path === "/recurring" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedErr("INVALID_REQUEST", 400);
      const { day_of_week, responsible } = body;
      if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6)
        return authedErr("INVALID_DAY", 400);
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
        return authedErr("DB_ERROR", 500, { detail: e?.message ?? String(e) });
      }
      return authedJson({ ok: true });
    }

    // ===== PUSH NOTIFICATIONS (TODO #7 phase 1) =====
    // Kept behind the auth boundary — a user must already be logged in
    // before reaching the "enable notifications" control, so there's no
    // need for a new public route the way /version is.
    if (path === "/push/vapid-public-key" && method === "GET") {
      return authedJson({ publicKey: env.VAPID_PUBLIC_KEY || null });
    }

    // A push subscription belongs to a browser/device, not an account — on a
    // shared household device, whoever last (re)subscribed owns it, so this
    // upserts by `endpoint` (the table's primary key), not by username.
    if (path === "/push/subscribe" && method === "POST") {
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

    // Called on toggle-off, and from the frontend's `pushsubscriptionchange`
    // handler when a browser silently rotates a subscription.
    if (path === "/push/subscribe" && method === "DELETE") {
      const body = await readJson(request);
      if (!body?.endpoint) return authedErr("INVALID_REQUEST", 400);
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1")
        .bind(body.endpoint).run();
      return authedJson({ ok: true });
    }

    // Shared household setting — same permission level as /recurring (any
    // list member, not owner-gated). Holds only stale_item_days now (the
    // shopping list's stale-item marker threshold, a per-list shopping
    // behaviour); the meal/weekly reminder preferences moved to per-device
    // storage (see /push/reminder-settings). No row exists until someone
    // changes the threshold, so GET falls back to the app-level default.
    if (path === "/notification-settings" && method === "GET") {
      const row = await env.DB.prepare(
        "SELECT stale_item_days FROM notification_settings WHERE list_id = ?1"
      ).bind(user.list_id).first();
      return authedJson({
        stale_item_days: row?.stale_item_days ?? 7,
      });
    }

    if (path === "/notification-settings" && method === "POST") {
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

    // Per-device meal-planning reminder preferences (device-only
    // notifications): each browser's push subscription carries its own
    // enabled/time, so members control their own reminders and one member
    // can't toggle another's. Identified by the subscription `endpoint` the
    // frontend already holds; scoped to the caller's own list so a stray
    // endpoint from another household can't be read or written. Any list
    // member (same level as /notification-settings). Defaults (enabled,
    // 18:00) are returned when this device isn't subscribed yet.
    if (path === "/push/reminder-settings" && method === "GET") {
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

    if (path === "/push/reminder-settings" && method === "POST") {
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

    // On-demand "get the other person's attention" ping (TODO #7 phase 2).
    // Any list member, same permission level as /recurring — not owner-gated.
    // Fixed message (not a free-typed one) to sidestep needing input
    // sanitization/length-capping for phase 2. A 2-minute per-list cooldown
    // (tracked in notification_state, not the IP-keyed rate_limit_attempts
    // table — this needs a per-*list* throttle regardless of who's sending,
    // not a per-IP one) stops repeated taps from spamming the household.
    if (path === "/push/ping" && method === "POST") {
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
