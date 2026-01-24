# Journal Data Schema (v1)

Goal: collect consistent meal data for future AI analysis.

## Minimal per meal (required)
- id: string
- createdAt: ISO string
- label: short description
- items: FoodItemRef[]
  - foodId: string
  - multiplier: number (1.0 default)
  - portionGrams: number (optional)
  - nutritionSource: db | off | estimated | custom
  - calories_kcal: number (optional, custom total for the item portion)
  - protein_g: number (optional, custom total for the item portion)
  - carbs_g: number (optional, custom total for the item portion)
  - fat_g: number (optional, custom total for the item portion)

## Recommended per meal (high value)
- mealType: breakfast | lunch | dinner | snack
- timeLocal: "HH:mm"
- location: home | work | restaurant | other
- hungerBefore: 1..5
- satietyAfter: 1..5
- planned: boolean
- notes: string
- photoUri: string (optional)

## Optional daily context
- waterMl
- sleepHours
- stressLevel
- steps
- activityMinutes
- weightKg

## Example
```json
{
  "id": "entry_2026_01_21_001",
  "createdAt": "2026-01-21T12:35:00.000Z",
  "label": "Poulet + riz",
  "items": [
    {
      "foodId": "chicken_breast",
      "multiplier": 1.0,
      "portionGrams": 180,
      "nutritionSource": "db"
    }
  ],
  "mealType": "lunch",
  "timeLocal": "12:35",
  "location": "home",
  "hungerBefore": 4,
  "satietyAfter": 4,
  "planned": true,
  "notes": "post training"
}
```

## Notes
- Current types live in `toki-app/lib/stats.ts` (MealEntry, FoodItemRef).
- Keep new fields optional to avoid breaking existing data.
