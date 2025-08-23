import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/subscription-service'

export async function POST(request: NextRequest) {
  try {
    const { gymId, amount, paymentId } = await request.json()

    if (!gymId || !amount) {
      return NextResponse.json(
        { error: 'Gym ID and amount are required' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    const result = await SubscriptionService.rechargeWallet(gymId, amount, paymentId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Wallet recharge API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
