# Load & Stress Testing

Uses [k6](https://k6.io/) for load/stress testing against live Supabase edge functions.

## Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Run Tests

```bash
# Set environment variables
export SUPABASE_URL="https://xkybsjnvuohpqpbkikyn.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export TEST_TENANT_ID="2b902657-6a20-4435-a78a-576f397517ca"

# Smoke test (1 user, 30s)
k6 run scripts/load-testing/edge-functions.js --env SUPABASE_URL=$SUPABASE_URL --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Load test (50 concurrent users, 5 min)
k6 run scripts/load-testing/edge-functions.js --env SUPABASE_URL=$SUPABASE_URL --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY --vus 50 --duration 5m

# Stress test (ramp to 200 users)
k6 run scripts/load-testing/stress-test.js --env SUPABASE_URL=$SUPABASE_URL --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

## Test Scenarios

| Script | Purpose | Default Config |
|--------|---------|----------------|
| `edge-functions.js` | Health check, CORS, auth endpoints | 10 VUs, 1 min |
| `stress-test.js` | Ramp to peak load, verify graceful degradation | 1→200 VUs over 10 min |
| `checkin-flow.js` | Full check-in creation flow | 20 VUs, 3 min |

## Thresholds

| Metric | Target | Critical |
|--------|--------|----------|
| p95 response time | < 500ms | > 2000ms |
| Error rate | < 1% | > 5% |
| Request rate | > 100 req/s | < 10 req/s |
