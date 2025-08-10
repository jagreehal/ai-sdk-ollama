import { test, expect } from '@playwright/test';

test.describe('AI Generation Basic Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to load
    await page.waitForTimeout(5000);
  });

  test('should successfully generate text with llama3.2', async ({ page }) => {
    // Check if llama3.2 is available in the dropdown
    await page.waitForTimeout(2000);
    const modelOptions = await page.locator('#model option').allTextContents();
    const hasLlama32 = modelOptions.some(option => option.includes('llama3.2'));
    
    if (!hasLlama32) {
      console.log('llama3.2 model not available, skipping test');
      return;
    }
    
    // Select llama3.2 model - find the option value first
    const llama32Option = await page.locator('#model option').filter({ hasText: /llama3\.2/ }).first();
    const llama32Value = await llama32Option.getAttribute('value');
    if (llama32Value) {
      await page.selectOption('#model', llama32Value);
    }
    
    // Enter a simple prompt
    await page.fill('#prompt', 'Say hello in exactly 3 words');
    
    // Click generate
    await page.locator('#generateBtn').click();
    
    // Should show generating state
    await expect(page.locator('#response')).toContainText('Generating response', { timeout: 5000 });
    
    // Wait for response (up to 30 seconds)
    await page.waitForFunction(
      () => {
        const response = document.querySelector('#response')?.textContent || '';
        return !response.includes('Generating response') && !response.includes('Response will appear here');
      },
      undefined,
      { timeout: 30000 }
    );
    
    // Response should contain text
    const responseText = await page.locator('#response').textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(10); // Should have meaningful content
    
  }, { timeout: 60000 });

  test('should handle model selection properly', async ({ page }) => {
    // Should have models loaded
    await page.waitForTimeout(3000);
    const modelCount = await page.locator('#model option').count();
    expect(modelCount).toBeGreaterThan(0);
    
    // Should have a model selected (first one is auto-selected)
    const initialValue = await page.locator('#model').inputValue();
    expect(initialValue).toBeTruthy(); // Should have some model selected
    
    // Should be able to select a model
    const firstModel = await page.locator('#model option:nth-child(2)').textContent();
    if (firstModel && firstModel !== 'Select a model...') {
      await page.selectOption('#model', { index: 1 });
      const selectedValue = await page.locator('#model').inputValue();
      expect(selectedValue).toBeTruthy();
    }
  });

  test('should clear response correctly', async ({ page }) => {
    // Fill some content in the prompt
    await page.fill('#prompt', 'Test prompt');
    
    // Click clear
    await page.locator('#clearBtn').click();
    
    // Should show default message
    await expect(page.locator('#response')).toContainText('Response will appear here', { timeout: 5000 });
  });
});