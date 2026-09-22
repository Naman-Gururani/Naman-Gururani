# One-time setup for the GitHub profile

The repository exists and its README is already the profile page. Everything
below is done once, in the browser, after this branch lands on `main`.

1. **Turn private work on:** [Settings → Public profile](https://github.com/settings/profile)
   → Contributions → tick **Include private contributions on my profile**. Most
   of the account's activity is private; without this the cards and the snake
   draw a year that looks empty.
2. **Optional — add a `METRICS_TOKEN` secret:** repo → Settings → Secrets and
   variables → Actions → New repository secret, named `METRICS_TOKEN`, holding a
   personal access token with **`read:user`** and **`repo`**. Both stats
   workflows use it when it is there and fall back to the built-in
   `GITHUB_TOKEN` when it is not. The fallback still renders — correctly
   labelled — but it cannot see private repositories, so the commit figure is
   the public remainder and the snake eats only public squares.
3. **Run each workflow once by hand:** repo → Actions → pick the workflow → Run
   workflow. They are scheduled daily afterwards and commit only when something
   changed.
   - **Contribution snake** — run this one first. Its first run creates the
     `output` branch that the README's snake images are served from; until then
     those two images 404.
   - **Stats cards** — redraws the four cards from the live API.
   - **Latest blog posts** — needs the blog to be live, so run it after the site
     is deployed.
4. **Pin `portfolio`:** profile page → Customize your pins → select `portfolio`
   (the game repository, renamed from `lineage`). Pin the site repo too if you
   like — it is public by necessity.
5. Optional polish, two minutes each:
   - Profile settings: add the site URL (naman-gururani.github.io) and a
     one-line bio matching the README's first sentence.
   - Give `portfolio` a social-preview image (repo Settings → Social preview) —
     a screenshot of the island.
