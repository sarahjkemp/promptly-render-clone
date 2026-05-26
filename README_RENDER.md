# PRomptly Render Clone

This is the original PRomptly app adapted into single-user mode for Render.

## What changed

- Login and registration are bypassed.
- The app always uses one built-in local user.
- Data is stored in memory instead of a database.
- Company documents, article processing, results, settings, and the original UI remain in place.

## Render setup

1. Push this folder to a GitHub repo.
2. Create a new Render Web Service from the repo.
3. Render will use `render.yaml`.
4. Add `OPENAI_API_KEY` in Render.
5. Deploy.

## Important note

Because storage is in memory, uploaded documents and generated history reset when the service restarts or redeploys.

If you want, the next improvement is to add a lightweight persistent store for:

- company documents
- article history
- generated outputs

without bringing back the old multi-user/auth/database complexity.
