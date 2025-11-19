### Webhook Timeout Hotfix Instructions

**Repository:** `whisper` (Chatwoot codebase at `/Users/wahyusaputra/dev/widget-works/whisper`)

**Goal:** Increase webhook timeout from 5 to 15 seconds to prevent false "Failed to send" errors when sending media files through Evolution API.

**Context:** We were in the middle of developing the broadcast feature on `feature/broadcast` branch with many uncommitted changes when this hotfix became necessary.

---

## Execution Status

### Current State (as of session start):
- **Working Directory:** `/Users/wahyusaputra/dev/widget-works/whisper`
- **Current Branch:** `feature/broadcast`
- **Modified Files:** 21 modified files (unstaged)
- **Untracked Files:** Multiple new files including docs and components
- **Status:** Behind origin/feature/broadcast by 1 commit

### Steps to Execute:

**Step 0: Save Current Work (IMPORTANT)**

Before switching to main, stash all current work to preserve the broadcast feature development:

```bash
# Save all work including untracked files
git stash push -u -m "WIP: broadcast feature development - saved before hotfix"
```

**Step 1: Create the Hotfix Branch**

1.  Check out the `main` branch and ensure it is up-to-date.
2.  Create a new branch named `hotfix/webhook-timeout` from `main`.

```bash
git checkout main
git pull origin main --ff-only
git checkout -b hotfix/webhook-timeout
```

**Step 2: Apply the Code Change**

1.  Locate the file: `lib/webhooks/trigger.rb`.
2.  Find the line of code containing `timeout: 5`.
3.  Replace it with `timeout: 15`.

**Step 3: Commit and Push the Change**

1.  Commit the change with the following message: `fix: Increase webhook timeout to 15 seconds`.
2.  Push the new `hotfix/webhook-timeout` branch to the remote repository.

```bash
git add lib/webhooks/trigger.rb
git commit -m "fix: Increase webhook timeout to 15 seconds"
git push origin hotfix/webhook-timeout
```

**Step 4: Create a Pull Request**

1.  Create a pull request from the `hotfix/webhook-timeout` branch to the `main` branch.
2.  Use the following details for the pull request:
    *   **Title:** `Fix: Increase Webhook Timeout to 15s`
    *   **Body:**
        ```
        This hotfix increases the webhook timeout from 5 seconds to 15 seconds.

        This resolves an issue where sending media files would result in a "Failed to send" error in the UI, even though the message was successfully delivered. The previous 5-second timeout was too short for the Evolution API to process the file and respond in time.
        ```

**Step 5: Return to Feature Branch and Restore Work**

After the PR is merged to main:

```bash
# Switch back to feature branch
git checkout feature/broadcast

# Pull the latest from remote
git pull origin feature/broadcast

# Merge the hotfix from main
git merge main

# Restore the stashed work
git stash pop

# Push the updated feature branch (after resolving any conflicts)
git push origin feature/broadcast
```

---

## Restoration Instructions (if needed in new session)

If this session is interrupted, to restore the broadcast feature work:

```bash
cd /Users/wahyusaputra/dev/widget-works/whisper
git checkout feature/broadcast
git stash list  # Find the stash named "WIP: broadcast feature development - saved before hotfix"
git stash apply stash@{N}  # Replace N with the correct stash index
```

## File to Modify

**Target File:** `lib/webhooks/trigger.rb` (in whisper repository)
**Change:** `timeout: 5` → `timeout: 15`
**Reason:** Previous 5-second timeout was insufficient for Evolution API to process media files and respond, causing false "Failed to send" errors in the UI even when messages were successfully delivered.
