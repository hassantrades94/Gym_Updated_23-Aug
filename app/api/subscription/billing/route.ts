import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/subscription-service'

export async function POST(request: NextRequest) {
  try {
    const { gymId, action } = await request.json()

    if (!gymId) {
      return NextResponse.json(
        { error: 'Gym ID is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'process_billing':
        const billingResult = await SubscriptionService.processMonthlyBilling(gymId)
        return NextResponse.json(billingResult)

      case 'get_subscription_data':
        const subscriptionData = await SubscriptionService.calculateSubscriptionData(gymId)
        return NextResponse.json(subscriptionData)

      case 'get_visible_members':
        const visibleMembers = await SubscriptionService.getVisibleMembers(gymId)
        return NextResponse.json({ members: visibleMembers })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Subscription billing API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gymId = searchParams.get('gymId')

    if (!gymId) {
      return NextResponse.json(
        { error: 'Gym ID is required' },
        { status: 400 }
      )
    }

    const subscriptionData = await SubscriptionService.calculateSubscriptionData(gymId)
    return NextResponse.json(subscriptionData)
  } catch (error) {
    console.error('Get subscription data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
