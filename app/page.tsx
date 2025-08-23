import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dumbbell, Users, Trophy, Smartphone, Camera, Zap, Target, Award, TrendingUp } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
              <Dumbbell className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              Flexio
            </span>
          </div>
          <Link href="/auth/signin">
            <Button
              variant="outline"
              size="sm"
              className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white bg-transparent"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="px-4 py-8">
        <div className="max-w-md mx-auto text-center space-y-8">
          <div className="space-y-6">
            <div className="relative">
              <h1 className="text-5xl font-bold leading-tight mb-4">
                <span className="bg-gradient-to-r from-white via-red-200 to-red-400 bg-clip-text text-transparent">
                  Smart Gym
                </span>
                <br />
                <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
                  Revolution
                </span>
              </h1>
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-red-500 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xl text-gray-300 leading-relaxed">
              Transform your fitness journey with AI-powered nutrition analysis, smart rewards, and seamless gym
              management.
            </p>
            
            {/* Register Your Gym Button - Fixed width to match other blocks */}
            <div className="mt-6">
              <Link href="/auth/signup?type=owner" className="block">
                <Button className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-5 text-xl font-semibold rounded-xl shadow-lg">
                  <Dumbbell className="h-6 w-6 mr-2" />
                  Register Your Gym
                </Button>
              </Link>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-4 py-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">AI</div>
              <div className="text-xs text-gray-400">Powered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">GPS</div>
              <div className="text-xs text-gray-400">Check-ins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">₹</div>
              <div className="text-xs text-gray-400">Rewards</div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="space-y-4">
            {/* AI Calorie Analysis - Featured */}
            <Card className="bg-gradient-to-br from-red-950 to-red-900 border-red-800 border-2">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-red-500 p-3 rounded-xl">
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-bold text-xl text-white mb-2">AI Calorie Scanner</h3>
                    <p className="text-red-200 text-sm leading-relaxed">
                      Snap a photo of your food and get instant nutrition analysis. Track calories, protein, carbs &
                      more with cutting-edge AI technology.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs text-yellow-300 font-medium">5 FREE scans monthly</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4">
              <Card className="bg-gray-800 border-gray-700 hover:border-red-500 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-blue-900 p-2 rounded-lg">
                    <Smartphone className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">Smart GPS Check-ins</h3>
                    <p className="text-sm text-gray-400">Automatic rewards when you arrive at your gym</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700 hover:border-red-500 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-green-900 p-2 rounded-lg">
                    <Trophy className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">Earn Real Money</h3>
                    <p className="text-sm text-gray-400">100 coins per visit • Redeem for membership discounts</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700 hover:border-red-500 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-purple-900 p-2 rounded-lg">
                    <Target className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">Personalized Nutrition</h3>
                    <p className="text-sm text-gray-400">AI-generated meal plans for your fitness goals</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700 hover:border-red-500 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-orange-900 p-2 rounded-lg">
                    <Users className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">Social Fitness</h3>
                    <p className="text-sm text-gray-400">Leaderboards, referrals & birthday celebrations</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700 hover:border-red-500 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-yellow-900 p-2 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">Progress Tracking</h3>
                    <p className="text-sm text-gray-400">BMI monitoring, streaks & achievement system</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* CTA Section - Remove the Register Your Gym button from here */}
          <div className="space-y-6 pt-8">
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-400">
                Already have an account?{" "}
                <Link href="/auth/signin" className="text-red-400 hover:text-red-300 font-medium">
                  Sign in here
                </Link>
              </p>

              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span>• Free AI Scans</span>
                <span>• No Setup Fees</span>
                <span>• Instant Rewards</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
