# Guardian Agent Pull Request Setup

The Guardian Agent can automatically create pull requests for software fixes it generates. This requires GitHub integration via Supabase Edge Functions.

## Prerequisites

1. **GitHub Personal Access Token** with permissions:
   - `repo` (full control of private repositories)
   - `write:packages` (if using GitHub Packages)
   - Scopes: `repo`, `workflow`

2. **Supabase Project** with Edge Functions enabled

3. **Repository Access** - Token must have access to your repository

## Setup Steps

### 1. Create GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token"
3. Give it a descriptive name: `Guardian Agent PR Token`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again)

### 2. Configure Supabase Environment Variables

Add these environment variables to your Supabase Edge Function:

```bash
# In Supabase Dashboard → Edge Functions → Secrets

GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-github-username-or-org
GITHUB_REPO=your-repo-name
```

**Example:**
```bash
GITHUB_TOKEN=ghp_abc123def456ghi789jkl012mno345pqr678
GITHUB_OWNER=WellFitCommunity
GITHUB_REPO=WellFit-Community-Daily-Complete
```

### 3. Deploy the Edge Function

```bash
npx supabase functions deploy guardian-pr-service --project-ref YOUR_PROJECT_REF
```

**Or using the Supabase CLI:**

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy guardian-pr-service
```

### 4. Test the Integration

Run this test in your browser console or TypeScript:

```typescript
import { GitService } from './services/guardian-agent/GitService';

// Test GitHub connection
const isConfigured = await GitService.checkGitHubCLI();
console.log('GitHub configured:', isConfigured);

// Test PR creation
const result = await GitService.createFixPullRequest({
  issue: {
    id: 'test-001',
    category: 'test_issue',
    severity: 'low',
    description: 'Testing Guardian PR creation',
    affectedResources: ['src/test/example.ts']
  },
  action: {
    id: 'action-001',
    strategy: 'fix_syntax_error',
    description: 'Test fix'
  },
  changes: [
    {
      filePath: 'TEST.md',
      newContent: '# Test File\n\nThis is a test created by Guardian Agent.\n',
      operation: 'create'
    }
  ],
  reviewers: ['your-github-username']
});

console.log('PR Result:', result);
```

## How It Works

### Architecture

```
Browser (React App)
    ↓
GitService.ts (Client)
    ↓ supabase.functions.invoke()
Supabase Edge Function (guardian-pr-service)
    ↓ GitHub API calls
GitHub.com
    ↓
Pull Request Created
```

### Flow

1. **Detection**: Guardian Agent detects an issue
2. **Analysis**: Generates fix code
3. **Approval**: User approves the fix (or auto-approved if safe)
4. **PR Request**: `GitService.createFixPullRequest()` called
5. **Edge Function**: Server-side GitHub API operations
6. **PR Creation**: Branch created, files committed, PR opened
7. **Audit Log**: All actions logged to `audit_logs` table

### Security

- ✅ **GitHub token never exposed to browser**
- ✅ **All Git operations server-side** (Edge Function)
- ✅ **Full audit trail** in database
- ✅ **Review required** for critical fixes
- ✅ **Automatic labeling** (guardian-agent, severity:*)

## Audit Trail

Every PR operation is logged:

```sql
SELECT * FROM audit_logs
WHERE event_type IN (
  'GUARDIAN_PR_REQUEST_INITIATED',
  'GUARDIAN_PR_CREATED_SUCCESS',
  'GUARDIAN_PR_CREATION_FAILED',
  'GUARDIAN_PR_MERGED'
)
ORDER BY timestamp DESC;
```

## Troubleshooting

### Error: "GitHub credentials not configured"

**Solution:** Set `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` in Supabase Edge Function secrets.

### Error: "Failed to create branch"

**Causes:**
- Token doesn't have `repo` permission
- Branch already exists
- Repository doesn't exist or token doesn't have access

**Solution:**
1. Verify token permissions in GitHub
2. Check repository name is correct
3. Ensure token has access to the repository

### Error: "Failed to create PR"

**Causes:**
- Base branch doesn't exist
- No changes to commit
- Rate limit exceeded

**Solution:**
1. Verify `baseBranch` exists (default: `main`)
2. Check that changes are valid
3. Wait if rate limited (GitHub limits: 5000 requests/hour)

### Verify Edge Function Deployment

```bash
npx supabase functions list --project-ref YOUR_PROJECT_REF
```

Should show:
```
guardian-pr-service  Deployed
```

## Cost Analysis

**GitHub API Rate Limits:**
- Authenticated: 5,000 requests/hour
- Typical PR creation: ~5 requests
- Max PRs per hour: ~1,000

**Supabase Edge Function:**
- Free tier: 500K invocations/month
- Paid: $2 per 1M invocations

**Estimated Monthly Cost:**
- 100 PRs/month = $0.00 (well within free tier)
- 10,000 PRs/month = $0.20

## Example PR Generated by Guardian

```markdown
## Guardian Agent Auto-Fix

> ⚠️ **This PR was automatically generated by the Guardian Agent.**
> Please review carefully before merging.

### Issue Detected
- **Category:** console_log_in_production
- **Severity:** high
- **Description:** Console statements found in HIPAA-compliant code

**Affected Resources:**
- src/services/drugInteractionService.ts
- src/components/admin/AdminPanel.tsx

### Healing Action
- **Strategy:** remove_console_statements
- **Description:** Replace console.log with auditLogger for HIPAA compliance

### Changes Made
- `update` src/services/drugInteractionService.ts
- `update` src/components/admin/AdminPanel.tsx

### Testing Checklist
- [ ] Automated tests pass
- [ ] Manual testing completed
- [ ] No unintended side effects
- [ ] Security implications reviewed

---
*Generated by Guardian Agent* 🛡️
```

## Labels Applied Automatically

- `guardian-agent` - All Guardian PRs
- `severity:critical` / `severity:high` / `severity:medium` / `severity:low`
- `auto-generated`

## Configuration Options

### Custom Reviewers

```typescript
const result = await GitService.createFixPullRequest({
  // ... issue and action config
  reviewers: ['maria', 'senior-dev', 'security-team']
});
```

### Custom Branch Names

```typescript
const result = await GitService.createFixPullRequest({
  // ... issue and action config
  branchName: 'hotfix/security-fix-2024',
  baseBranch: 'develop'  // Default: 'main'
});
```

## Production Checklist

- [ ] GitHub token created with correct permissions
- [ ] Environment variables set in Supabase
- [ ] Edge Function deployed and tested
- [ ] Test PR created successfully
- [ ] Audit logs verified
- [ ] Team members added as reviewers
- [ ] GitHub labels configured
- [ ] CI/CD pipeline runs on Guardian PRs

## Support

If you encounter issues:

1. Check Supabase Edge Function logs
2. Verify GitHub token permissions
3. Review audit logs for error details
4. Test with a simple file change first

**Zero console.log statements** - All logging goes through auditLogger ✅
**Zero tech debt** - Clean, production-ready implementation ✅
