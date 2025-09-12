#!/bin/bash

# Stripe Setup Script
# This script helps set up Stripe products and prices

echo "Starting Stripe setup..."

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "Error: Stripe CLI is not installed."
    echo "Please install it from: https://stripe.com/docs/stripe-cli"
    exit 1
fi

# Check if user is logged in to Stripe
echo "Checking Stripe login status..."
if ! stripe login --status &> /dev/null; then
    echo "Please log in to Stripe first:"
    stripe login
fi

# Create products and prices
echo "Creating Stripe products and prices..."

# Basic Plan
echo "Creating Basic Plan..."
basic_product=$(stripe products create \
    --name="基础版" \
    --description="适合个人用户和小型项目" \
    --metadata=plan_id=1)

basic_price_monthly=$(stripe prices create \
    --product=$(echo $basic_product | jq -r '.id') \
    --currency=usd \
    --unit-amount=999 \
    --recurring-interval=month)

echo "Basic Plan Created:"
echo "  Product ID: $(echo $basic_product | jq -r '.id')"
echo "  Price ID (Monthly): $(echo $basic_price_monthly | jq -r '.id')"

# Pro Plan
echo "Creating Pro Plan..."
pro_product=$(stripe products create \
    --name="专业版" \
    --description="适合中小企业和专业人士" \
    --metadata=plan_id=2)

pro_price_monthly=$(stripe prices create \
    --product=$(echo $pro_product | jq -r '.id') \
    --currency=usd \
    --unit-amount=2999 \
    --recurring-interval=month)

echo "Pro Plan Created:"
echo "  Product ID: $(echo $pro_product | jq -r '.id')"
echo "  Price ID (Monthly): $(echo $pro_price_monthly | jq -r '.id')"

# Enterprise Plan
echo "Creating Enterprise Plan..."
enterprise_product=$(stripe products create \
    --name="企业版" \
    --description="适合大型企业和团队" \
    --metadata=plan_id=3)

enterprise_price_monthly=$(stripe prices create \
    --product=$(echo $enterprise_product | jq -r '.id') \
    --currency=usd \
    --unit-amount=9999 \
    --recurring-interval=month)

echo "Enterprise Plan Created:"
echo "  Product ID: $(echo $enterprise_product | jq -r '.id')"
echo "  Price ID (Monthly): $(echo $enterprise_price_monthly | jq -r '.id')"

# Create webhook endpoint
echo "Setting up webhook endpoint..."
webhook=$(stripe webhooks create \
    --url="https://yourdomain.com/api/webhooks/stripe" \
    --enabled-events="customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed,checkout.session.completed")

echo "Webhook Created:"
echo "  Webhook ID: $(echo $webhook | jq -r '.id')"
echo "  Webhook Secret: $(echo $webhook | jq -r '.secret')"

echo ""
echo "Setup completed!"
echo ""
echo "Please update your .env.local with the following values:"
echo "STRIPE_PUBLISHABLE_KEY=$(echo $basic_product | jq -r '.livemode') && echo 'pk_live_xxx' || echo 'pk_test_xxx'"
echo "STRIPE_SECRET_KEY=$(echo $basic_product | jq -r '.livemode') && echo 'sk_live_xxx' || echo 'sk_test_xxx'"
echo "STRIPE_WEBHOOK_SECRET=$(echo $webhook | jq -r '.secret')"
echo ""
echo "Also update the price IDs in your subscription creation logic:"
echo "Basic Plan Monthly: $(echo $basic_price_monthly | jq -r '.id')"
echo "Pro Plan Monthly: $(echo $pro_price_monthly | jq -r '.id')"
echo "Enterprise Plan Monthly: $(echo $enterprise_price_monthly | jq -r '.id')"