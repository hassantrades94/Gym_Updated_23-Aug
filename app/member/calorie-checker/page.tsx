"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Camera,
  Zap,
  LogOut,
  Home,
  CreditCard,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function CalorieChecker() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showAddToLogPrompt, setShowAddToLogPrompt] = useState(false)
  const [memberData] = useState({
    name: "Alex Johnson",
    freeScansUsed: 2,
    freeScansLimit: 5,
    coinValue: 4.0,
  })

  const packages = [
    {
      id: 1,
      scans: 150,
      price: 49,
      popular: false,
    },
    {
      id: 2,
      scans: 300,
      price: 79,
      popular: true,
    },
  ]

  const handleImageCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (memberData.freeScansUsed >= memberData.freeScansLimit) {
        toast({
          title: "Free scans exhausted",
          description: "Please purchase a package to continue analyzing food images.",
          variant: "destructive",
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
        analyzeImage(file)
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeImage = async (file: File) => {
    setIsAnalyzing(true)
    setAnalysisResult(null)
    setShowAddToLogPrompt(false)

    try {
      const formData = new FormData()
      formData.append("image", file)

      const response = await fetch("/api/analyze-food", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setAnalysisResult(data.analysis)
        setShowAddToLogPrompt(true)
        toast({
          title: "Analysis complete! 🎉",
          description: `Food identified with ${data.analysis.confidence}% confidence`,
        })
      } else {
        throw new Error(data.error || "Analysis failed")
      }
    } catch (error) {
      console.error("Error analyzing image:", error)
      toast({
        title: "Analysis failed",
        description: "Unable to analyze the image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleLogout = () => {
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    })
    setTimeout(() => {
      window.location.href = "/auth/signin"
    }, 1000)
  }

  const purchasePackage = async (packageId: number) => {
    const selectedPackage = packages.find((p) => p.id === packageId)
    if (!selectedPackage) return

    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: selectedPackage.price * 100, // Convert to paise
          currency: "INR",
          receipt: `package_${packageId}_${Date.now()}`,
          notes: {
            package_id: packageId,
            scans: selectedPackage.scans,
          },
        }),
      })

      const orderData = await response.json()

      const options = {
        ...orderData.razorpayOptions,
        handler: (response: any) => {
          toast({
            title: "Payment successful! 🎉",
            description: `You now have ${selectedPackage.scans} food scans available.`,
          })
          // Update user's scan count in database
        },
        prefill: {
          name: memberData.name,
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (error) {
      console.error("Error creating order:", error)
      toast({
        title: "Payment failed",
        description: "Unable to process payment. Please try again.",
        variant: "destructive",
      })
    }
  }

  const addToFoodLog = () => {
    if (!analysisResult) return

    const currentTime = new Date()
    const timeString = currentTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    const hour = currentTime.getHours()
    let mealType = "Snack"
    if (hour >= 6 && hour < 11) mealType = "Breakfast"
    else if (hour >= 11 && hour < 16) mealType = "Lunch"
    else if (hour >= 16 && hour < 21) mealType = "Dinner"

    const foodLogEntry = {
      id: Date.now(),
      foodName: analysisResult.foodName,
      mealType,
      time: timeString,
      calories: analysisResult.calories,
      protein: analysisResult.protein,
      carbohydrates: analysisResult.carbohydrates,
      fat: analysisResult.fat,
      date: currentTime.toDateString(),
      logged: true,
    }

    const existingLog = JSON.parse(localStorage.getItem("foodLog") || "[]")
    existingLog.push(foodLogEntry)
    localStorage.setItem("foodLog", JSON.stringify(existingLog))

    setShowAddToLogPrompt(false)
    toast({
      title: "Added to Food Log! 📝",
      description: `${analysisResult.foodName} has been logged for ${mealType}`,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#da1c24] border-b border-red-800">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <Zap className="h-5 w-5 text-[#da1c24]" />
              </div>
              <span className="font-bold text-white text-lg">Flexio</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-white/20">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pt-20">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">AI Calorie Checker</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Snap a photo of your food to get instant nutrition analysis
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Free Scans</CardTitle>
                  <CardDescription>
                    {memberData.freeScansUsed} of {memberData.freeScansLimit} used this month
                  </CardDescription>
                </div>
                <Sparkles className="h-6 w-6 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={(memberData.freeScansUsed / memberData.freeScansLimit) * 100} className="w-full" />
              <p className="text-xs text-gray-500 mt-2">Resets at the end of each month</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                {selectedImage ? (
                  <div className="space-y-4">
                    <img
                      src={selectedImage || "/placeholder.svg"}
                      alt="Selected food"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    {isAnalyzing && (
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Clock className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Analyzing your food...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Camera className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Capture Your Food</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Take a clear photo of your meal for accurate nutrition analysis
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <Button
                  onClick={handleImageCapture}
                  disabled={isAnalyzing || memberData.freeScansUsed >= memberData.freeScansLimit}
                  className="w-full"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      {selectedImage ? "Analyze Another Photo" : "Take Photo"}
                    </>
                  )}
                </Button>

                {memberData.freeScansUsed >= memberData.freeScansLimit && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Free scans exhausted
                      </span>
                    </div>
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                      Purchase a package below to continue analyzing your food
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {analysisResult && (
            <div className="space-y-4">
              <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {analysisResult.foodName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Analysis •{" "}
                        {new Date().toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                      {analysisResult.confidence}% Match
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{analysisResult.calories} cal</span>
                    <span>P: {analysisResult.protein}g</span>
                    <span>C: {analysisResult.carbohydrates}g</span>
                    <span>F: {analysisResult.fat}g</span>
                  </div>
                </CardContent>
              </Card>

              {showAddToLogPrompt && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                  <CardContent className="p-4">
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-blue-800 dark:text-blue-200">Add to Food Log?</h3>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                        Would you like to add this meal to your daily food log for tracking?
                      </p>
                      <div className="flex gap-3">
                        <Button onClick={addToFoodLog} className="flex-1 bg-blue-600 hover:bg-blue-700">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Yes, Add to Log
                        </Button>
                        <Button onClick={() => setShowAddToLogPrompt(false)} variant="outline" className="flex-1">
                          No, Thanks
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Upgrade Your Analysis</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get more food scans with our affordable packages
              </p>
            </div>

            {packages.map((pkg) => (
              <Card key={pkg.id} className={pkg.popular ? "border-blue-500 relative" : ""}>
                {pkg.popular && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
                    Most Popular
                  </Badge>
                )}
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{pkg.scans} Food Scans</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        ₹{(pkg.price / pkg.scans).toFixed(2)} per scan
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">₹{pkg.price}</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => purchasePackage(pkg.id)}
                    className="w-full"
                    variant={pkg.popular ? "default" : "outline"}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Purchase Package
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#da1c24] border-t border-red-800">
        <div className="max-w-md mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <Link href="/member/dashboard" className="flex flex-col items-center gap-1 text-white hover:text-white/80">
              <Home className="h-5 w-5" />
              <span className="text-xs font-medium">Home</span>
            </Link>

            <Link
              href="/member/calorie-checker"
              className="flex flex-col items-center gap-1 text-white hover:text-white/80"
            >
              <div className="p-2 bg-white/20 rounded-full">
                <Camera className="h-7 w-7" />
              </div>
              <span className="text-xs font-medium">Calorie Checker</span>
            </Link>

            <Link href="/member/payment" className="flex flex-col items-center gap-1 text-white hover:text-white/80">
              <CreditCard className="h-5 w-5" />
              <span className="text-xs font-medium">Payment</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
