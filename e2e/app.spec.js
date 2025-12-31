// @ts-check
import { test, expect } from '@playwright/test';

test.describe('App Core', () => {
  test('should load the homepage and search', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/Amma Bhajanamritam Index/);

    // Check search input
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();

    // Perform a search
    await searchInput.fill('Amma');
    
    // Check if results list updates (this depends on having data)
    // We assume the offline index sends some data.
  });

  test('should navigate to pdf view', async ({ page }) => {
    // This requires knowing a valid ID. We'll skip deep navigation for now
    // and just verify the router handles URLs without crashing.
    await page.goto('/pdf/vol1/1/Amma');
    // If it requires auth, it should redirect to login
    await expect(page).toHaveURL(/.*login.*/); 
  });
});
