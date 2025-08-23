import { NextRequest, NextResponse } from 'next/server'
import { SubscriptionService } from '@/lib/subscription-service'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request (you can add auth headers in production)
    const authHeader = request.headers.get('authorization')
    
    // In production, you should verify this is from your cron service
    // For now, we'll allow any request for development
    
    await SubscriptionService.checkBillingDue()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Billing check completed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Cron billing error:', error)
    return NextResponse.json(
      { error: 'Failed to process billing check' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gymId } = await request.json()
    
    if (gymId) {
      // Manual billing trigger for specific gym
      const result = await SubscriptionService.processMonthlyBilling(gymId)
      return NextResponse.json(result)
    } else {
      // Process billing for all gyms
      await SubscriptionService.checkBillingDue()
      return NextResponse.json({ 
        success: true, 
        message: 'All gyms billing processed' 
      })
    }
  } catch (error) {
    console.error('Manual billing trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to process billing' },
      { status: 500 }
    )
  }
}
