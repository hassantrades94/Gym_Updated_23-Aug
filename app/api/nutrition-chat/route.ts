import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { message, memberDetails, chatHistory } = await request.json()

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          {
            role: "system",
            content: `You are a professional nutrition assistant for Flexio gym. Member details: ${memberDetails.name}, ${memberDetails.age} years old, ${memberDetails.weight}kg, ${memberDetails.height}cm, goal: ${memberDetails.goal}. Provide personalized, practical nutrition advice and meal plans. Keep responses concise and actionable.`,
          },
          ...chatHistory.map((msg: { type: "user" | "bot"; message: string }) => ({
            role: msg.type === "user" ? "user" : "assistant",
            content: msg.message,
          })),
          {
            role: "user",
            content: message,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    const data = await response.json()

    return NextResponse.json({
      response: data.choices[0]?.message?.content || "I apologize, but I cannot provide a response right now.",
    })
  } catch (error) {
    console.error("OpenRouter API error:", error)
    return NextResponse.json({ error: "Failed to get nutrition advice" }, { status: 500 })
  }
}
