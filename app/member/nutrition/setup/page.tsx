"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, ArrowRight, User, Target, Apple, Globe, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function NutritionSetupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)

  const [formData, setFormData] = useState({
    // Personal Info
    age: "",
    gender: "",
    height: "",
    weight: "",
    activityLevel: "",

    // Goals
    primaryGoal: "",
    targetWeight: "",
    timeframe: "",

    // Dietary Preferences
    dietType: "",
    allergies: [] as string[],
    dislikes: [] as string[],
    cuisinePreference: "",

    // Lifestyle
    mealsPerDay: "",
    cookingTime: "",
    budget: "",
  })

  const totalSteps = 4

  const activityLevels = [
    { id: "sedentary", label: "Sedentary", description: "Little to no exercise" },
    { id: "light", label: "Lightly Active", description: "Light exercise 1-3 days/week" },
    { id: "moderate", label: "Moderately Active", description: "Moderate exercise 3-5 days/week" },
    { id: "very", label: "Very Active", description: "Hard exercise 6-7 days/week" },
    { id: "extra", label: "Extra Active", description: "Very hard exercise, physical job" },
  ]

  const goals = [
    { id: "lose", label: "Lose Weight", description: "Create a caloric deficit" },
    { id: "gain", label: "Gain Weight", description: "Build muscle and mass" },
    { id: "maintain", label: "Maintain Weight", description: "Stay at current weight" },
    { id: "muscle", label: "Build Muscle", description: "Focus on strength and muscle growth" },
    { id: "endurance", label: "Improve Endurance", description: "Enhance athletic performance" },
  ]

  const dietTypes = [
    { id: "balanced", label: "Balanced Diet", description: "All food groups included" },
    { id: "vegetarian", label: "Vegetarian", description: "No meat, includes dairy and eggs" },
    { id: "vegan", label: "Vegan", description: "Plant-based only" },
    { id: "keto", label: "Ketogenic", description: "High fat, very low carb" },
    { id: "paleo", label: "Paleo", description: "Whole foods, no processed items" },
    { id: "mediterranean", label: "Mediterranean", description: "Fish, olive oil, whole grains" },
  ]

  const commonAllergies = ["Nuts", "Dairy", "Gluten", "Eggs", "Soy", "Fish", "Shellfish", "Sesame"]

  const cuisineOptions = [
    { id: "local", label: "Local Cuisine", description: "Focus on regional dishes and ingredients" },
    { id: "international", label: "International", description: "Diverse global cuisines" },
    { id: "mixed", label: "Mixed", description: "Combination of local and international" },
  ]

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsGenerating(true)

    // Simulate AI plan generation
    setTimeout(() => {
      toast({
        title: "Nutrition profile created!",
        description: "Your personalized meal plan is being generated.",
      })
      router.push("/member/nutrition")
      setIsGenerating(false)
    }, 3000)
  }

  const handleAllergyChange = (allergy: string, checked: boolean) => {
    if (checked) {
      setFormData((prev) => ({ ...prev, allergies: [...prev.allergies, allergy] }))
    } else {
      setFormData((prev) => ({ ...prev, allergies: prev.allergies.filter((a) => a !== allergy) }))
    }
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.age && formData.gender && formData.height && formData.weight && formData.activityLevel
      case 2:
        return formData.primaryGoal
      case 3:
        return formData.dietType && formData.cuisinePreference
      case 4:
        return formData.mealsPerDay && formData.cookingTime
      default:
        return false
    }
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Sparkles className="h-16 w-16 text-purple-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Generating Your Plan</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Our AI is creating personalized meal plans based on your preferences and goals.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Analyzing your nutritional needs
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Selecting recipes for your preferences
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                Creating your weekly meal plan
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link href="/member/nutrition">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nutrition Setup</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStep} of {totalSteps}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6">
        <div className="max-w-md mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Progress</span>
              <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-500" />
                  Personal Information
                </CardTitle>
                <CardDescription>Tell us about yourself to calculate your nutritional needs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <RadioGroup
                      value={formData.gender}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="male" />
                        <Label htmlFor="male">Male</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="female" />
                        <Label htmlFor="female">Female</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData((prev) => ({ ...prev, height: e.target.value }))}
                      placeholder="175"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.target.value }))}
                      placeholder="70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Activity Level</Label>
                  <RadioGroup
                    value={formData.activityLevel}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, activityLevel: value }))}
                  >
                    {activityLevels.map((level) => (
                      <div key={level.id} className="flex items-start space-x-2">
                        <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={level.id} className="font-medium">
                            {level.label}
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{level.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Goals */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Your Goals
                </CardTitle>
                <CardDescription>What do you want to achieve with your nutrition plan?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Primary Goal</Label>
                  <RadioGroup
                    value={formData.primaryGoal}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, primaryGoal: value }))}
                  >
                    {goals.map((goal) => (
                      <div key={goal.id} className="flex items-start space-x-2">
                        <RadioGroupItem value={goal.id} id={goal.id} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={goal.id} className="font-medium">
                            {goal.label}
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {(formData.primaryGoal === "lose" || formData.primaryGoal === "gain") && (
                  <div className="space-y-2">
                    <Label htmlFor="targetWeight">Target Weight (kg)</Label>
                    <Input
                      id="targetWeight"
                      type="number"
                      value={formData.targetWeight}
                      onChange={(e) => setFormData((prev) => ({ ...prev, targetWeight: e.target.value }))}
                      placeholder="65"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Dietary Preferences */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Apple className="h-5 w-5 text-red-500" />
                  Dietary Preferences
                </CardTitle>
                <CardDescription>Help us customize your meal plans</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Diet Type</Label>
                  <RadioGroup
                    value={formData.dietType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, dietType: value }))}
                  >
                    {dietTypes.map((diet) => (
                      <div key={diet.id} className="flex items-start space-x-2">
                        <RadioGroupItem value={diet.id} id={diet.id} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={diet.id} className="font-medium">
                            {diet.label}
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{diet.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Cuisine Preference</Label>
                  <RadioGroup
                    value={formData.cuisinePreference}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, cuisinePreference: value }))}
                  >
                    {cuisineOptions.map((cuisine) => (
                      <div key={cuisine.id} className="flex items-start space-x-2">
                        <RadioGroupItem value={cuisine.id} id={cuisine.id} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={cuisine.id} className="font-medium">
                            {cuisine.label}
                          </Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{cuisine.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Allergies & Restrictions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {commonAllergies.map((allergy) => (
                      <div key={allergy} className="flex items-center space-x-2">
                        <Checkbox
                          id={allergy}
                          checked={formData.allergies.includes(allergy)}
                          onCheckedChange={(checked) => handleAllergyChange(allergy, checked as boolean)}
                        />
                        <Label htmlFor={allergy} className="text-sm">
                          {allergy}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Lifestyle */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-purple-500" />
                  Lifestyle & Preferences
                </CardTitle>
                <CardDescription>Final details to perfect your meal plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Meals per day</Label>
                  <RadioGroup
                    value={formData.mealsPerDay}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, mealsPerDay: value }))}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="3" id="3meals" />
                      <Label htmlFor="3meals">3 meals</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="4" id="4meals" />
                      <Label htmlFor="4meals">3 meals + 1 snack</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="5" id="5meals" />
                      <Label htmlFor="5meals">3 meals + 2 snacks</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="6" id="6meals" />
                      <Label htmlFor="6meals">6 small meals</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Cooking time preference</Label>
                  <RadioGroup
                    value={formData.cookingTime}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, cookingTime: value }))}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="quick" id="quick" />
                      <Label htmlFor="quick">Quick (15-30 min)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="moderate" id="moderate" />
                      <Label htmlFor="moderate">Moderate (30-60 min)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="long" id="long" />
                      <Label htmlFor="long">I enjoy cooking (60+ min)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Budget preference</Label>
                  <RadioGroup
                    value={formData.budget}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, budget: value }))}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="budget" id="budget" />
                      <Label htmlFor="budget">Budget-friendly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="moderate" id="moderateBudget" />
                      <Label htmlFor="moderateBudget">Moderate</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="premium" id="premium" />
                      <Label htmlFor="premium">Premium ingredients</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={!isStepValid()}>
              {currentStep === totalSteps ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Plan
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
