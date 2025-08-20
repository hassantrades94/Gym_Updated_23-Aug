"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Camera, Send, Bot, User, Apple } from "lucide-react"

export default function NutritionPage() {
  const [hasProfile, setHasProfile] = useState(true)
  const [chatMessages, setChatMessages] = useState([
    {
      type: "bot",
      message:
        "Hi Alex! I'm your AI nutrition assistant. I have your profile details - 25 years old, 70kg, 175cm, with a goal to build muscle. How can I help you today?",
    },
  ])
  const [chatInput, setChatInput] = useState("")
  const [loggedFoods, setLoggedFoods] = useState([
    {
      id: 1,
      name: "Grilled Chicken Salad",
      mealType: "Lunch",
      time: "12:30 PM",
      calories: 580,
      protein: 45,
      carbs: 25,
      fat: 28,
      logged: true,
    },
    {
      id: 2,
      name: "Overnight Oats with Berries",
      mealType: "Breakfast",
      time: "8:00 AM",
      calories: 420,
      protein: 15,
      carbs: 65,
      fat: 12,
      logged: true,
    },
  ])

  const memberDetails = {
    name: "Alex Johnson",
    age: 25,
    weight: 70,
    height: 175,
    goal: "build muscle",
  }

  const quickPrompts = [
    "Create a meal plan for me to lose weight",
    "Create a meal plan to gain muscle",
    "Create a high protein meal plan using local foods found in Assam",
  ]

  const handleSendMessage = async (message: string) => {
    setChatMessages((prev) => [...prev, { type: "user", message }])
    setChatInput("")

    try {
      const response = await fetch("/api/nutrition-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          memberDetails,
          chatHistory: chatMessages,
        }),
      })

      const data = await response.json()

      setChatMessages((prev) => [
        ...prev,
        {
          type: "bot",
          message: data.response || "I'm sorry, I couldn't process your request right now. Please try again.",
        },
      ])
    } catch (error) {
      console.error("Error calling nutrition API:", error)
      setChatMessages((prev) => [
        ...prev,
        {
          type: "bot",
          message: "I'm experiencing some technical difficulties. Please try again in a moment.",
        },
      ])
    }
  }

  const handleImageUpload = () => {
    // Simulate food analysis
    const newFood = {
      id: Date.now(),
      name: "Analyzed Food Item",
      mealType: "Snack",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      calories: Math.floor(Math.random() * 400) + 200,
      protein: Math.floor(Math.random() * 30) + 10,
      carbs: Math.floor(Math.random() * 40) + 15,
      fat: Math.floor(Math.random() * 20) + 5,
      logged: true,
    }
    setLoggedFoods((prev) => [newFood, ...prev])
  }

  if (!hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm border-gray-700">
          <CardHeader className="text-center">
            <Apple className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              AI Nutrition Planning
            </CardTitle>
            <CardDescription className="text-gray-300">
              Get personalized meal plans and nutrition guidance powered by AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/member/nutrition/setup">
              <Button
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                size="lg"
              >
                Set Up Nutrition Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link href="/member/dashboard">
            <Button variant="ghost" size="sm" className="p-2 text-white hover:bg-gray-700">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              Nutrition
            </h1>
            <p className="text-sm text-gray-400">AI-powered meal planning</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="max-w-md mx-auto">
          <Tabs defaultValue="meal-plans" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 border-gray-700">
              <TabsTrigger value="meal-plans" className="text-white data-[state=active]:bg-red-600">
                Meal Plans
              </TabsTrigger>
              <TabsTrigger value="food-log" className="text-white data-[state=active]:bg-red-600">
                Food Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="meal-plans" className="space-y-6">
              <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Bot className="h-5 w-5 text-red-500" />
                    AI Nutrition Assistant
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Get personalized meal plans based on your profile
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400 mb-3">Quick Actions:</p>
                    {quickPrompts.map((prompt, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="w-full justify-start text-left h-auto p-3 bg-gray-700/50 border-gray-600 text-white hover:bg-gray-600"
                        onClick={() => handleSendMessage(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <ScrollArea className="h-64 w-full rounded-md border border-gray-700 p-4 bg-gray-900/50">
                      <div className="space-y-4">
                        {chatMessages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex gap-3 ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`flex gap-2 max-w-[80%] ${msg.type === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  msg.type === "bot" ? "bg-red-600" : "bg-gray-600"
                                }`}
                              >
                                {msg.type === "bot" ? (
                                  <Bot className="h-4 w-4 text-white" />
                                ) : (
                                  <User className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <div
                                className={`p-3 rounded-lg ${
                                  msg.type === "bot" ? "bg-gray-800 text-gray-200" : "bg-red-600 text-white"
                                }`}
                              >
                                <p className="text-sm">{msg.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2 mt-4">
                      <Input
                        placeholder="Ask about meal plans..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400"
                        onKeyPress={(e) => e.key === "Enter" && chatInput.trim() && handleSendMessage(chatInput)}
                      />
                      <Button
                        onClick={() => chatInput.trim() && handleSendMessage(chatInput)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="food-log" className="space-y-6">
              <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Camera className="h-5 w-5 text-red-500" />
                    Log Food by Image
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Take a photo of your food for instant nutrition analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleImageUpload}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Food Image
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Today's Food Log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loggedFoods.map((food) => (
                    <div key={food.id} className="p-4 rounded-lg bg-green-50/10 border border-green-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-white text-lg">{food.name}</h3>
                          <p className="text-gray-400 text-sm">
                            {food.mealType} • {food.time}
                          </p>
                        </div>
                        <Badge className="bg-green-600/20 text-green-400 border-green-500/30">Logged</Badge>
                      </div>
                      <div className="flex justify-between text-sm text-gray-300">
                        <span className="font-medium">{food.calories} cal</span>
                        <span>P: {food.protein}g</span>
                        <span>C: {food.carbs}g</span>
                        <span>F: {food.fat}g</span>
                      </div>
                    </div>
                  ))}

                  {loggedFoods.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No food logged yet today</p>
                      <p className="text-sm">Take a photo to get started!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
