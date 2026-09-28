# Twitch chat overlay Resources

## Knowledge

- [Netlify credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
  Current plan allowances, reset behavior, and free-plan hard limit. Use when estimating whether this static overlay fits the monthly budget.
- [How Netlify credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
  Current metering rates for production deploys, bandwidth, and requests. Recheck before making a long-term cost estimate.
- [Netlify Legacy pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/)
  Allowances for older Free/Starter/Pro teams. Use this instead of credit-plan math when the account dashboard identifies a Legacy plan.
- [Legacy billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-faq-for-legacy-plans/)
  Explains whether sites remain online, builds stop, or sites pause when a legacy free limit is reached.
- [Netlify CLI: getting started](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
  How CLI deploys choose build and publish settings, including values from `netlify.toml`.
- [Twitch IRC concepts](https://dev.twitch.tv/docs/chat/irc)
  Twitch's WebSocket endpoint and the IRC messages and tags this project reads.

## Wisdom (Communities)

- [Netlify support forum](https://answers.netlify.com/)
  Community help for account-specific billing, deploy failures, and dashboard questions.

## Gaps

- The current workspace has no Git metadata, so its original Git remote, production branch, and continuous-deployment setup cannot be confirmed from local files.
