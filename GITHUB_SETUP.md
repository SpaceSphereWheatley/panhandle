# GitHub Setup

## 1. Create a GitHub repository

1. Go to github.com and create a new repository called `panhandle` (or whatever you like)
2. Clone it locally (or initialize it and push the files)
3. Add all files:
   ```
   git add .
   git commit -m "Initial commit: Panhandle shopping list + meal planner"
   git push -u origin main
   ```

## 2. Link Cloudflare Pages to GitHub

This makes the frontend auto-deploy on every push.

1. Go to **Workers & Pages** → **Pages**
2. **Create application** → **Connect to Git**
3. Authorize GitHub, select the `panhandle` repo
4. Build settings:
   - **Framework preset:** None
   - **Build command:** (leave blank)
   - **Build output directory:** `public/`
5. Click **Save and Deploy**

From now on, every push to the `main` branch auto-deploys the frontend.

## 3. Set up GitHub Actions for Worker auto-deploy

This makes the Worker auto-deploy when you change `worker/index.js`.

### 3a. Get Cloudflare credentials

1. Go to **My Account** (bottom left in Cloudflare dashboard)
2. **API Tokens** → **Create Token**
3. Use the **"Edit Cloudflare Workers"** template
4. Copy the token (you'll need it in a moment)
5. Also note your **Account ID** (visible under **Workers** → overview, or in **My Account** → **Accounts**)

### 3b. Add secrets to GitHub

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add these:

| Name | Value |
|------|-------|
| `CLOUDFLARE_API_TOKEN` | Paste the API token from 3a |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `JWT_SECRET` | Your JWT secret (same as in Cloudflare) |
| `SEED_SECRET` | Your seed secret (can be anything, only used once) |

After you've seeded accounts and deleted SEED_SECRET from Cloudflare, you can leave the GitHub secret as-is (it won't be used).

### 3c. Update wrangler.toml

1. Open `wrangler.toml` in the repo
2. Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with your actual D1 database ID (from Cloudflare)
3. Commit and push

The workflow is now ready. Every time you push changes to `worker/index.js`, GitHub Actions will automatically deploy them.

## 4. Make a test change

To verify it works:
1. Edit `worker/index.js` (e.g., add a comment at the top)
2. Commit and push
3. Go to GitHub repo → **Actions** and watch the workflow run
4. After ~30 seconds, you should see ✅ "Deploy Worker" passed
5. Check `shopping.mohibb.com` to confirm the update deployed

## Troubleshooting

**Actions tab shows error:**
- Check the error message in the workflow logs
- Most common issue: `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` is wrong or missing
- Make sure all four secrets are set

**Pages not updating:**
- Pages requires the `public/` folder to be at the repo root
- Check **Workers & Pages** → **Pages** → your project → **Settings** to verify the build output directory is `public/`

**Worker not updating:**
- Make sure your change is in `worker/index.js` (not just any file in the repo)
- The workflow only triggers on changes to `worker/index.js` or `.github/workflows/deploy.yml`
- If you want it to trigger on other files, edit `.github/workflows/deploy.yml` and change the `paths:` section

---

Once set up, you can ignore the command line entirely. Just:
1. Edit files in GitHub or clone locally and push
2. Pages auto-deploys the frontend
3. GitHub Actions auto-deploys the Worker
4. Secrets stay safe in GitHub (never in the repo)
