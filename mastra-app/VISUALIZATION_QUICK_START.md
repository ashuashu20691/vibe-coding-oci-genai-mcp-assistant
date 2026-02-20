# Quick Start Guide: New Visualizations

## 🚀 Using the New Visualization Types

### Photo Gallery

**When it's used:**
- Automatically when data has image URLs + similarity/score fields
- Perfect for: photo search results, image galleries, visual comparisons

**Example Query:**
```sql
SELECT 
  photo_url,
  similarity_score,
  views,
  distance_km,
  year,
  landmark_name
FROM photos
WHERE similarity_score > 0.7
ORDER BY similarity_score DESC;
```

**Features:**
- Similarity badges (color-coded by score)
- Sort by similarity
- Filter by minimum similarity
- Group by year/month/day
- Metadata chips (views, distance, etc.)

---

### Interactive Map

**When it's used:**
- Automatically when data has latitude + longitude fields
- Perfect for: location data, geographic analysis, proximity searches

**Example Query:**
```sql
SELECT 
  landmark_name,
  latitude,
  longitude,
  views,
  distance_km
FROM photos
WHERE distance_km < 32;
```

**Features:**
- Interactive zoom and pan
- Click markers for details
- Radius circles (if center point provided)
- Auto-fit to show all locations
- Popup with full metadata

---

### Timeline

**When it's used:**
- Automatically when data has date/time fields + >5 records + year/month column
- Perfect for: historical data, event sequences, temporal analysis

**Example Query:**
```sql
SELECT 
  photo_id,
  taken_date,
  year,
  landmark_name,
  views
FROM photos
ORDER BY taken_date DESC;
```

**Features:**
- Expandable time periods
- Group by year/month/day
- Chronological ordering
- Item count badges
- Formatted date labels

---

## 💡 Tips & Tricks

### Force a Specific Visualization

```typescript
// In your code
const result = await generateVisualization({
  data: queryResults,
  type: 'photo_gallery', // Force photo gallery
  title: 'My Custom Title',
  groupBy: 'year'
});
```

### Combine Multiple Visualizations

The smart query returns multiple visualizations:

```typescript
const result = await orchestrator.smartQuery(sql);

// result.visualizations includes:
// - Auto-detected primary visualization
// - Table (always available)
// - Additional relevant types
```

### Use with SQL Playground

1. Execute your query
2. Results automatically render with best visualization
3. Switch between visualization types using the UI

---

## 🎨 Customization Options

### Photo Gallery

```typescript
{
  imageUrlField: 'photo_url',      // Auto-detected if not specified
  similarityField: 'similarity_score', // Auto-detected if not specified
  groupBy: 'year',                 // 'year' | 'month' | 'day'
  title: 'Similar Photos'
}
```

### Map

```typescript
{
  latField: 'latitude',            // Auto-detected if not specified
  lonField: 'longitude',           // Auto-detected if not specified
  centerLat: 28.6139,              // Optional center point
  centerLon: 77.2090,              // Optional center point
  radiusMiles: 20,                 // Optional radius circle
  title: 'Location Map'
}
```

### Timeline

```typescript
{
  timeField: 'taken_date',         // Auto-detected if not specified
  groupBy: 'year',                 // 'year' | 'month' | 'day'
  title: 'Photo Timeline'
}
```

---

## 🔍 Auto-Detection Examples

### Example 1: Photo Similarity Search

**Query:**
```sql
SELECT photo_url, similarity_score, views, year
FROM photos;
```

**Auto-detected as:** `photo_gallery`  
**Why:** Has `photo_url` (image field) + `similarity_score` (score field)

---

### Example 2: Geographic Data

**Query:**
```sql
SELECT name, latitude, longitude, population
FROM cities;
```

**Auto-detected as:** `map`  
**Why:** Has `latitude` + `longitude` fields

---

### Example 3: Time Series

**Query:**
```sql
SELECT order_date, amount, customer_id
FROM orders;
```

**Auto-detected as:** `line_chart`  
**Why:** Has `order_date` (time field) + `amount` (numeric field)

---

### Example 4: Timeline

**Query:**
```sql
SELECT event_name, event_date, year, description
FROM events
ORDER BY event_date DESC;
```

**Auto-detected as:** `timeline`  
**Why:** Has `event_date` (time field) + `year` column + >5 records

---

## 🎯 Real-World Use Cases

### Use Case 1: Photo Similarity Dashboard

```sql
-- Find similar photos near Delhi
SELECT 
  p.photo_url,
  p.similarity_score,
  p.views,
  p.latitude,
  p.longitude,
  p.distance_km,
  p.year,
  p.landmark_name
FROM photos p
WHERE p.distance_km < 32 
  AND p.views > 100
ORDER BY p.similarity_score DESC;
```

**Result:** Photo gallery grouped by year with similarity badges

---

### Use Case 2: Sales by Region

```sql
-- Sales locations on map
SELECT 
  store_name,
  store_latitude AS latitude,
  store_longitude AS longitude,
  total_sales,
  region
FROM stores
WHERE total_sales > 100000;
```

**Result:** Interactive map with sales data in popups

---

### Use Case 3: Historical Events

```sql
-- Timeline of company milestones
SELECT 
  milestone_name,
  milestone_date,
  EXTRACT(YEAR FROM milestone_date) AS year,
  description,
  impact_score
FROM company_milestones
ORDER BY milestone_date DESC;
```

**Result:** Timeline grouped by year with expandable details

---

## 🛠️ Troubleshooting

### Photo Gallery Not Showing

**Check:**
- Data has a field with 'url', 'image', or 'photo' in the name
- Data has a field with 'similarity' or 'score' in the name
- Both fields exist in the same dataset

**Fix:**
```typescript
// Explicitly specify fields
{
  imageUrlField: 'my_image_url',
  similarityField: 'my_score'
}
```

---

### Map Not Rendering

**Check:**
- Data has latitude and longitude fields
- Values are valid numbers (not null/NaN)
- Field names include 'lat'/'latitude' and 'lon'/'lng'/'longitude'

**Fix:**
```typescript
// Explicitly specify fields
{
  latField: 'my_lat',
  lonField: 'my_lon'
}
```

---

### Timeline Not Grouping

**Check:**
- Data has >5 records
- Has a date/time field
- Has a 'year' or 'month' column OR groupBy option specified

**Fix:**
```typescript
// Explicitly specify grouping
{
  timeField: 'my_date',
  groupBy: 'year'
}
```

---

## 📚 Additional Resources

- **Full Documentation:** See `VISUALIZATION_EXTENSION_SUMMARY.md`
- **Implementation Plan:** See `implementation_plan.md`
- **Multi-Agent Guide:** See `MULTI_AGENT_GUIDE.md`
- **Usage Examples:** See `USAGE_EXAMPLE.md`

---

## 🎉 You're Ready!

Start using the new visualizations by:
1. Running your SQL queries as normal
2. Let auto-detection choose the best visualization
3. Enjoy beautiful, interactive results!

**Example:**
```bash
npm run dev
# Navigate to http://localhost:3000
# Execute a query with photo/location/time data
# Watch the magic happen! ✨
```
