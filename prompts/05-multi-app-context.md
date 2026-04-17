# Prompt 5 — Multi-App Business Context (Optional)

If your monorepo has multiple apps but Claude Code cannot detect the business
relationship from code alone, prepend this context to Prompt 1 to seed the
discovery phase.

Without business context, Claude Code will only detect technical signals
(shared env vars, shared DB, event emitters) and may miss implicit relationships.

---

## Template — fill in your actual app details

```
Context before scanning:

This repo contains multiple web applications that interact:

- App A: <apps/admin>
  - Purpose: <e.g. merchants create and manage orders>
  - Users: <e.g. merchant staff, internal operators>
  - Key actions: <e.g. create order, approve payment, cancel>

- App B: <apps/customer>
  - Purpose: <e.g. customers view and track their orders>
  - Users: <e.g. end customers>
  - Key actions: <e.g. view order, confirm delivery, leave review>

Shared backend: <apps/api>
  - Tech: <NestJS + Postgres + Redis>
  - Key flows: <order.created event, order.updated webhook>

Expected cross-app behaviors:
1. When a merchant creates an order in App A, the customer sees it in App B within <N> seconds.
2. When a customer cancels in App B, the merchant sees status "Cancelled" in App A on refresh.
3. When a customer's delivery is confirmed in App B, App A reflects it in real time.
4. <add more as needed>

Known edge cases to cover:
- <e.g. App B is offline — App A should show warning banner but not crash>
- <e.g. Customer tries to view an order that belongs to another account>
- <add more as needed>

Now proceed with Prompt 1 (discovery + scenario matrix).
```

---

## When to use this

- Technical signals alone don't reveal the business relationship
- The two apps communicate via a shared database only (no events, no direct API)
- You want to cover business invariants, not just code-level integrations
- README and code comments are sparse or missing

## When NOT to use this

- Single-app project — not relevant
- Multi-app project with clear documentation / README already describing the flows
- You want Claude Code to reason purely from the code (e.g. for verification)
