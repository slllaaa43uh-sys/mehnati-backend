# Frontend Components for Global Jobs Search

This directory contains React components for displaying jobs from the Adzuna API integration.

## Components Overview

### 1. JobCard.jsx
The main job card component with smart logo loading.

**Features:**
- Displays job title, company, location, salary, and category
- Smart logo loading with Clearbit API
- Fallback to category-based icons when logo fails
- Beautiful UI with Tailwind CSS
- Responsive design

**Usage:**
```jsx
import { JobCard, JobList } from './JobCard';

// Single job card
<JobCard job={jobData} onClick={handleJobClick} />

// Job list with loading state
<JobList jobs={jobs} loading={isLoading} onJobClick={handleClick} />
```

### 2. JobsSearchPage.jsx
Complete search page with filters and pagination.

**Features:**
- Full-text search
- Location search
- Country selection (20+ countries)
- Category filter
- Contract type filter
- Salary range filter
- Pagination
- Loading states

**Usage:**
```jsx
import JobsSearchPage from './JobsSearchPage';

function App() {
  return <JobsSearchPage />;
}
```

### 3. useExternalJobs.js
Custom React hook for API integration.

**Features:**
- Automatic metadata loading
- Search with filters
- Pagination support
- Error handling
- Loading states

**Usage:**
```jsx
import { useExternalJobs } from './useExternalJobs';

function MyComponent() {
  const { 
    jobs, 
    loading, 
    error, 
    searchJobs,
    categories,
    countries,
    pagination
  } = useExternalJobs();

  const handleSearch = () => {
    searchJobs({
      country: 'us',
      what: 'developer',
      where: 'New York'
    });
  };

  return (
    <div>
      <button onClick={handleSearch}>Search</button>
      {loading && <p>Loading...</p>}
      {jobs.map(job => <JobCard key={job.id} job={job} />)}
    </div>
  );
}
```

## Dependencies

Make sure to install these dependencies:

```bash
npm install lucide-react
# or
yarn add lucide-react
```

## Tailwind CSS Configuration

These components use Tailwind CSS. Make sure your `tailwind.config.js` includes:

```js
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './frontend-components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/external-jobs` | GET | Search jobs |
| `/api/v1/external-jobs/categories` | GET | Get job categories |
| `/api/v1/external-jobs/countries` | GET | Get supported countries |

## Smart Logo Loading

The `SmartLogo` component implements intelligent logo loading:

1. **Primary**: Tries to load company logo from Clearbit API
   ```
   https://logo.clearbit.com/{company_name}.com
   ```

2. **Fallback**: If logo fails to load, displays a category-based icon with a colored background

### Category Icons Mapping

| Category | Icon | Color |
|----------|------|-------|
| IT Jobs | Code | Blue |
| Healthcare | Stethoscope | Red |
| Engineering | Wrench | Gray |
| Sales | Megaphone | Orange |
| Finance | DollarSign | Green |
| ... | ... | ... |

## Environment Variables

Set the API base URL in your `.env` file:

```env
REACT_APP_API_URL=http://localhost:5000
```

## Example Integration

```jsx
// App.jsx
import React from 'react';
import JobsSearchPage from './frontend-components/JobsSearchPage';

function App() {
  return (
    <div className="App">
      <JobsSearchPage />
    </div>
  );
}

export default App;
```

## Customization

### Custom Logo Fallback
You can customize the fallback avatar URL in `externalJobsService.js`:

```javascript
logoFallback: `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=random&color=fff&size=128`
```

### Custom Category Colors
Edit the `CATEGORY_COLORS` object in `JobCard.jsx` to change category colors.

### Custom Icons
Edit the `CATEGORY_ICONS` object in `JobCard.jsx` to change category icons.

## License

MIT
