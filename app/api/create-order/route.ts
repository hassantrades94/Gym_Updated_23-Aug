import { type NextRequest, NextResponse } from "next/server"
import Razorpay from "razorpay"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch (e) {
      console.error("Invalid JSON payload", e)
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    const { amount, currency, receipt, notes } = body

    console.log("Create order request:", { amount, currency, receipt, notes })
    console.log("Environment check:", {
      hasKeyId: !!process.env.RAZORPAY_KEY_ID,
      hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
      keyIdLength: process.env.RAZORPAY_KEY_ID?.length || 0,
    })

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("Missing Razorpay credentials")
      return NextResponse.json({ error: "Razorpay configuration missing" }, { status: 500 })
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })

    const safeReceipt = (typeof receipt === "string" ? receipt : String(receipt || "")).slice(0, 40)
    console.log("Creating Razorpay order...")
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: safeReceipt,
      notes,
    })

    console.log("Order created:", order.id)

    const razorpayOptions = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: "Flexio",
      description: notes?.type === "membership" ? "Gym Membership" : "Food Scans Package",
      order_id: order.id,
      theme: { color: "#da1c24" },
    }

    return NextResponse.json(
      {
        ...order,
        razorpayOptions,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("Razorpay order creation error:", error)
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 })
  }
}
