# Splitpush — Group Expense Management

A full-stack expense-sharing platform that lets groups track shared costs, split bills, and settle balances across multiple trips or events. Users create trips, add participants, record expenses, and automatically calculate who owes whom. Supports both per-trip settlements and global cross-trip balancing. Mobile support included.

**Live:** <https://splitpush.quangntran.com/>

Self-hosted on an Oracle Cloud VPS with Cloudflare in front for DNS, TLS, and caching. Earlier deployments on Render and Aiven are no longer updated but remain accessible.

---

## My process (first project with an AI coding assistant)

Splitpush was my first project built with an AI coding assistant (Cursor). It was a useful look at how much an LLM can accelerate the build once the idea is set — and how much of the normal engineering process still needs a human driving. The overall flow:

1. **💡 Determine the idea.** Simple enough — I can come up with some ideas.
2. **🛠️ Choose a tech stack.** Java Spring Boot is popular and PostgreSQL is widely used, so that worked well. REST APIs are still the most common and I understand them. GraphQL could work, but I'll leave that for another project.
3. **🧑‍💻 Write some code.**
4. **🔧 QA test and fix whatever broke.** While getting help from Cursor, this step felt like the most time-consuming part. Unit tests helped a lot, but there were many tiny breaks that kept popping up.
5. **✨ Add more small features and changes until it felt sufficiently complete.** In a formal project setting this would involve Change Requests sent to Change Control. Unfortunately for the devs (me), the stakeholders (me) pushed for many changes, so Change Control (me) approved everything.

---

## Key Features

- **✅ Secure account creation & login** — Users register and authenticate with email and a securely hashed password. Spring Security handles session protection, authentication flows, and access control across the app.
- **👥 Trip group creation & collaboration** — Create trip groups, invite members, and manage shared expenses. Each group supports multiple participants with permissions that prevent invalid edits or removals.
- **💰 Flexible expense tracking & splitting** — Add, edit, and delete expenses with customizable split options. Detailed participant info and clear breakdowns ensure transparency for every transaction.
- **📊 Balance dashboard with smart calculations** — A clean dashboard summarizes who owes whom, showing both per-group amounts and net totals across all activities; the logic automatically aggregates balances to simplify settling up.
- **🤝 Settlement tracking** — Record settlements with validation to prevent duplicate or inconsistent payments. All settlements update group and global balances instantly.
- **🧭 Group lifecycle management** — Groups can be joined via ID and left when balances are settled. Empty groups are automatically cleaned up.
- **🌗 Light & dark mode theming** — A CSS-variable theme system lets users switch between light and dark mode, with preferences saved across sessions.
- **⚡ Performance optimization with caching** — Caffeine cache reduces repeated database queries and speeds up rendering for group lists, expenses, and balance summaries.
- **🧾 Detailed expense history** — A full paginated history of all group expenses, complete with participant details and timestamps for clear auditability.

---

## Tech Stack

- **Frontend:** JavaScript, HTML, CSS, Thymeleaf
- **Backend:** Java, Spring Boot, Spring Security, Spring Data JPA, Spring Cache (Caffeine), PostgreSQL
- **Other:** Docker & Docker Compose, Maven, Cursor, Oracle Cloud VPS + Cloudflare
