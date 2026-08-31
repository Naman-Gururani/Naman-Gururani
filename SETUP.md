# One-time setup for the GitHub profile

1. **Create the magic repo:** a new **public** repo named exactly `naman-gururani` (same as your username). GitHub shows its README on your profile page.
2. Push this folder's contents to it:
   ```bash
   cd C:\AntiG\github-profile
   git init && git add -A && git commit -m "feat: profile README + blog feed"
   git branch -M main
   git remote add origin https://github.com/naman-gururani/naman-gururani.git
   git push -u origin main
   ```
3. **Fill the LinkedIn line** in README.md (there's a comment placeholder) — or delete it.
4. **Run the feed once:** repo → Actions → "Latest blog posts" → Run workflow. (It needs the blog to be live first, so do this after the site repo is deployed. It then runs twice a day by itself and commits only when a new post appears.)
5. **Pin `lineage`:** profile page → Customize your pins → select `lineage`. (Pin the site repo too if you like — it's public by necessity.)
6. Optional polish, two minutes each:
   - Profile settings: add the site URL (naman-gururani.github.io) and a one-line bio matching the README's first sentence.
   - Give `lineage` a social-preview image (repo Settings → Social preview) — a screenshot of the island.
