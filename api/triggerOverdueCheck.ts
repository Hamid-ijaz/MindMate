import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Manual trigger for overdue task check
 * This endpoint calls the same logic as the scheduled function
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests for manual triggers
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    console.log('🚀 Manual overdue task check triggered');
    
    // Import the checkOverdueTasks function
    const checkOverdueTasksHandler = await import('./checkOverdueTasks');
    
    // Create a mock request object for the scheduled function
    const mockReq = {
      ...req,
      method: 'POST',
    } as VercelRequest;
    
    // Create a response object to capture the result
    let result: any;
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          result = { statusCode: code, data };
          return mockRes;
        }
      }),
      json: (data: any) => {
        result = { statusCode: 200, data };
        return mockRes;
      }
    } as any;
    
    // Call the scheduled function
    await checkOverdueTasksHandler.default(mockReq, mockRes);
    
    // Return the result from the scheduled function
    return res.status(result.statusCode).json({
      success: true,
      message: 'Manual overdue task check completed',
      result: result.data,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ Error in manual overdue task check:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger overdue task check',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
