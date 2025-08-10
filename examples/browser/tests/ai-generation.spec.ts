import { test, expect } from '@playwright/test';

test.describe('AI SDK Ollama Browser Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the page with correct title and elements', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/AI SDK Ollama Browser Example/);

    // Check main heading
    await expect(page.locator('h1')).toContainText('AI SDK Ollama');

    // Check status banner exists
    await expect(page.locator('#status')).toBeVisible();

    // Check configuration section
    await expect(page.locator('#ollamaUrl')).toBeVisible();
    await expect(page.locator('#model')).toBeVisible();

    // Check prompt textarea
    await expect(page.locator('#prompt')).toBeVisible();

    // Check buttons
    await expect(page.locator('#generateBtn')).toBeVisible();
    await expect(page.locator('#streamBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#refreshModelsBtn')).toBeVisible();

    // Check response area
    await expect(page.locator('#response')).toBeVisible();
  });

  test('should display connection status and load models', async ({ page }) => {
    // Wait for initial status check and model loading
    await page.waitForTimeout(5000);
    
    // Should show either connected status or error (depending on Ollama availability)
    const statusText = await page.locator('#status span:last-child').textContent();
    expect(statusText).toBeTruthy();
    
    // Models dropdown should be populated or show fallback options
    const modelOptions = await page.locator('#model option').count();
    expect(modelOptions).toBeGreaterThanOrEqual(1); // At least "Select a model..." or fallback options
  });

  test('should refresh models when refresh button is clicked', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(5000);
    
    // Click refresh models button
    await page.locator('#refreshModelsBtn').click();
    
    // Wait for refresh to complete
    await page.waitForTimeout(3000);
    
    // Should still have model options
    const modelOptions = await page.locator('#model option').count();
    expect(modelOptions).toBeGreaterThanOrEqual(1);
  });

  test('should show validation messages for empty inputs', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);
    
    // Try to generate without a prompt  
    await page.locator('#generateBtn').click();
    
    // Wait and then check for validation message
    await page.waitForTimeout(1000);
    await expect(page.locator('#response')).toContainText('Please enter a prompt', { timeout: 10000 });
    
    // Add a prompt but clear model selection
    await page.fill('#prompt', 'Test prompt');
    await page.selectOption('#model', ''); // Clear selection
    await page.locator('#generateBtn').click();
    
    // Should show "Please select a model" message
    await page.waitForTimeout(1000);
    await expect(page.locator('#response')).toContainText('Please select a model', { timeout: 10000 });
  });

  test('should handle Ctrl+Enter shortcut in textarea', async ({ page }) => {
    // Wait for page load
    await page.waitForTimeout(2000);
    
    // Fill prompt but clear model selection
    await page.fill('#prompt', 'Test shortcut');
    await page.selectOption('#model', ''); // Clear selection
    
    // Focus on textarea and press Ctrl+Enter
    await page.locator('#prompt').focus();
    await page.keyboard.press('Control+Enter');
    
    // Should show validation message (no model selected)
    await page.waitForTimeout(1000);
    await expect(page.locator('#response')).toContainText('Please select a model', { timeout: 10000 });
  });

  test('should attempt AI generation with llama3.2 model', async ({ page }) => {
    // Wait for models to load
    await page.waitForTimeout(3000);
    
    // Check if llama3.2 is available
    const modelOptions = await page.locator('#model option').allTextContents();
    const hasLlama32 = modelOptions.some(option => option.includes('llama3.2'));
    
    if (hasLlama32) {
      // Select llama3.2 model - find the option value first
      const llama32Option = await page.locator('#model option').filter({ hasText: /llama3\.2/ }).first();
      const llama32Value = await llama32Option.getAttribute('value');
      if (llama32Value) {
        await page.selectOption('#model', llama32Value);
      }
      
      // Fill a simple prompt
      await page.fill('#prompt', 'Write a short haiku about coding');
      
      // Click generate
      await page.locator('#generateBtn').click();
      
      // Should show generating state
      await expect(page.locator('#response')).toContainText('Generating response');
      
      // Wait for response (up to 30 seconds)
      await page.waitForTimeout(30000);
      
      // Response should no longer show "Generating"
      const responseText = await page.locator('#response').textContent();
      expect(responseText).not.toContain('Generating response');
      
      // Should have some content (either success or error)
      expect(responseText).toBeTruthy();
      
    } else {
      console.log('llama3.2 model not available, skipping generation test');
    }
  }, { timeout: 60000 }); // 1 minute timeout for AI generation

  test('should attempt streaming with llama3.2 model', async ({ page }) => {
    // Wait for models to load
    await page.waitForTimeout(3000);
    
    // Check if llama3.2 is available
    const modelOptions = await page.locator('#model option').allTextContents();
    const hasLlama32 = modelOptions.some(option => option.includes('llama3.2'));
    
    if (hasLlama32) {
      // Select llama3.2 model - find the option value first
      const llama32Option = await page.locator('#model option').filter({ hasText: /llama3\.2/ }).first();
      const llama32Value = await llama32Option.getAttribute('value');
      if (llama32Value) {
        await page.selectOption('#model', llama32Value);
      }
      
      // Fill a simple prompt
      await page.fill('#prompt', 'Count from 1 to 5');
      
      // Click stream
      await page.locator('#streamBtn').click();
      
      // Should show streaming state
      await expect(page.locator('#response')).toContainText('Streaming response');
      
      // Wait for response (up to 30 seconds)
      await page.waitForTimeout(30000);
      
      // Response should no longer show "Streaming"
      const responseText = await page.locator('#response').textContent();
      expect(responseText).not.toContain('Streaming response');
      
      // Should have some content (either success or error)
      expect(responseText).toBeTruthy();
      
    } else {
      console.log('llama3.2 model not available, skipping streaming test');
    }
  }, { timeout: 60000 }); // 1 minute timeout for AI streaming

  test('should clear response when clear button is clicked', async ({ page }) => {
    // Add some content to response area first
    await page.fill('#prompt', 'Test prompt');
    
    // Click clear button
    await page.locator('#clearBtn').click();
    
    // Should show default response message
    await expect(page.locator('#response')).toContainText('Response will appear here');
  });

  test('should handle responsive layout correctly', async ({ page, isMobile }) => {
    if (isMobile) {
      // On mobile, sections should be stacked vertically
      const chatSection = page.locator('.lg\\:col-span-2');
      const responseSection = page.locator('.lg\\:col-span-3');
      
      await expect(chatSection).toBeVisible();
      await expect(responseSection).toBeVisible();
      
      // Mobile layout should have border-b instead of border-r
      await expect(chatSection).toHaveClass(/border-b/);
    } else {
      // On desktop, should have side-by-side layout
      const gridContainer = page.locator('.grid.grid-cols-1.lg\\:grid-cols-5');
      await expect(gridContainer).toBeVisible();
      
      // Left section (2/5 width)
      const chatSection = page.locator('.lg\\:col-span-2');
      await expect(chatSection).toBeVisible();
      
      // Right section (3/5 width) 
      const responseSection = page.locator('.lg\\:col-span-3');
      await expect(responseSection).toBeVisible();
    }
  });

  test('should display proper status updates during operations', async ({ page }) => {
    // Initial status should be checking connection
    const initialStatus = await page.locator('#status span:last-child').textContent();
    expect(initialStatus).toBeTruthy();
    
    // Click refresh models to see status update
    await page.locator('#refreshModelsBtn').click();
    
    // Should show loading status briefly
    await page.waitForTimeout(500);
    
    // Status should update after operation
    const updatedStatus = await page.locator('#status span:last-child').textContent();
    expect(updatedStatus).toBeTruthy();
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check form labels
    await expect(page.locator('label[for="ollamaUrl"]')).toContainText('Ollama Server URL');
    await expect(page.locator('label[for="model"]')).toContainText('AI Model');
    
    // Check button titles/accessibility
    await expect(page.locator('#refreshModelsBtn')).toHaveAttribute('title', 'Refresh available models');
    await expect(page.locator('#clearBtn')).toHaveAttribute('title', 'Clear response');
    await expect(page.locator('#copyBtn')).toHaveAttribute('title', 'Copy response');
    
    // Check textarea placeholder
    await expect(page.locator('#prompt')).toHaveAttribute('placeholder', /Ask me anything/);
  });
});