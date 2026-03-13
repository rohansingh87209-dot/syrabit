# Syrabit.ai — Enterprise Quality Checklist
# Run: npm run quality

## Automated Checks

### 1. Production Build
npm run build:prod
- Output: build/ directory
- Expected: Compiled successfully

### 2. Bundle Analysis  
npm run analyze
- Open: build/bundle-analysis.html
- Target: Main JS < 800KB gzipped

### 3. Lighthouse Audit
npm run lighthouse (requires serve running)
- Target: Performance 80+, PWA 70+, SEO 85+

### 4. Serve Production Build
npm run serve:prod  
- URL: http://localhost:3001

## Manual Checks

### PWA
- [ ] Chrome → DevTools → Application → Manifest → Valid
- [ ] Chrome → DevTools → Application → Service Workers → Active
- [ ] Chrome → Install app prompt appears
- [ ] Offline: Chrome → DevTools → Network → Offline → /library loads

### Security  
- [ ] DevTools → Network → Response headers include:
      X-Content-Type-Options: nosniff
      X-Frame-Options: SAMEORIGIN
      Referrer-Policy: strict-origin-when-cross-origin
- [ ] Admin routes return 401 without token
- [ ] Rate limit: 31+ chat messages/minute → 429

### Accessibility
- [ ] Tab through entire Library page — all focusable
- [ ] Screen reader: chat bubbles announced with aria-live
- [ ] Skip link works (Tab from address bar → Enter)
- [ ] All icon buttons have aria-label

### E2E Flows
- [ ] Landing → Signup → Onboarding → Library (AHSEC + DEGREE boards)
- [ ] Chat → Send message → Streaming response → Credits -1
- [ ] Admin login (dipakk32554@gmail.com / SyrAdmin#32554) → Dashboard
- [ ] Profile → All 9 sections visible → Edit name → Save
- [ ] 404 page → Back → Home

### Credits
- [ ] Free user: 30 credits/day limit
- [ ] Pro user: 7000 credits
- [ ] Out of credits: paywall banner + toast
- [ ] syrabit_done SSE event carries creditsUsed + remaining

### Monitoring (PostHog)
- [ ] Open DevTools → Network → posthog.com → events firing
- [ ] Signup event → user_signed_up
- [ ] Chat event → chat_message_sent  
- [ ] Error boundary trigger → error_boundary_triggered

## Score Targets
| Metric | Current | Target |
|--------|---------|--------|
| Lighthouse Performance | 55 | 80+ |
| Lighthouse PWA | 0 | 70+ |
| Lighthouse SEO | 65 | 85+ |
| Bundle (gzipped) | 376KB | <800KB |
| Rate limiting | Basic | 429 on 31+/min |
| Service Worker | None | Active + offline |
| Error Boundary | None | Full coverage |
| aria-labels | 4 | 50+ |
| PostHog events | Basic | 10+ events |
| syrabit_done SSE | No | Yes |
