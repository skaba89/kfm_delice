# Security Policy

## Supported versions
| Version | Supported |
|---------|-----------|
| main    | Active    |
| < 1.0   | Pre-release |

## Reporting a vulnerability
**Do not open a public GitHub issue.** Report privately:
1. Email: security@kfm-delice.com
2. GitHub Security Advisories: repo > Security > Report a vulnerability

Include: description, steps to reproduce, affected versions, impact, suggested fix.
We acknowledge within 72 hours.

## Scope
**In scope**: auth bypass, authorization flaws (IDOR, privilege escalation), SQL injection, XSS, CSRF, secrets leakage, path traversal, rate-limit bypass, push subscription hijacking.

**Out of scope**: third-party deps, social engineering, DoS without PoC, self-XSS.

## Security measures
- Password hashing: bcrypt (10 rounds)
- JWT: HS256, 1-day default expiry
- Multi-tenant isolation: every query scoped by restaurantId
- Rate limiting: 60 req/min API, 10 req/min auth (configurable)
- Input validation: Zod schemas on every endpoint
- SQL injection prevention: Prisma ORM; $queryRawUnsafe wrapped
- Push auth: VAPID-signed, per-user ownership enforced
- Secret hygiene: .env in .gitignore, pre-flight checks for hardcoded secrets
- Security headers: X-Content-Type-Options, X-Frame-Options, HSTS (HTTPS)

## Disclosure policy
- Acknowledge within 72 hours
- Validate within 7 days
- Develop fix within 30 days
- Coordinate disclosure after fix deployed (typically 90 days)

## Credits
- _(no reports yet)_
