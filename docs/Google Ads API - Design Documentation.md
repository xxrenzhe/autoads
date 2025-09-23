Company Name: AutoAds Inc.

Business Model: Our company operates a Software-as-a-Service (SaaS) platform named AutoAds, which is available to external, third-party advertisers via a monthly subscription. Our clients are professional advertisers who use our tool to more efficiently manage and analyze their own Google Ads accounts. We do not manage ads for any other business, nor do we use the tool to advertise for our own company.

Tool Access/Use: The AutoAds platform is a secure, web-based application. Paying subscribers log in to our tool and connect their own Google Ads accounts through a standard OAuth2 authorization flow. Once connected, they use our platform's interface to view performance reports and make management actions on their own campaigns. The tool is entirely self-service and is designed to improve our clients' operational efficiency.

Tool Design: Our tool is designed as a standard web application with a secure backend and a user-friendly frontend.

Data Reporting: After a user authorizes their account, our backend system periodically calls the Google Ads API to sync performance metrics and campaign structure data into our local, secure database. The user interface then reads from this database to quickly display performance dashboards and reports, allowing users to analyze trends over different time periods without delay.

Campaign Management: When a user wishes to make changes (e.g., update a budget or pause a campaign), they will use our tool's interface. These actions are sent as commands to our backend, which then constructs and sends the appropriate mutate requests to the Google Ads API to execute the changes in the user's account.

All interactions with the Google Ads API are handled exclusively by our secure backend servers. No sensitive credentials or API calls are ever exposed to the client-side browser.

API Services Called: Our tool primarily uses the following API services:

GoogleAdsService: To run reports and fetch performance data (e.g., clicks, impressions, cost) and entity structures (campaigns, ad groups).

CampaignService: To manage campaigns, such as updating their status or budget.

AdGroupService & AdGroupAdService: To make modifications to ad groups and ads, such as updating bids or Final URLs.

CustomerService: To retrieve the hierarchy of accounts accessible by the user.

Tool Mockup: Below is a mockup of the main dashboard of our AutoAds tool. It demonstrates how users can view aggregated performance data and access their campaigns for management.