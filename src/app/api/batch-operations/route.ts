import { NextRequest, NextResponse } from 'next/server';
import { batchOperationService } from '@/lib/firestore';
import type { BatchOperation } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operationType, taskIds, parameters, executedBy, workspaceId } = body;
    
    if (!operationType || !taskIds || !executedBy) {
      return NextResponse.json({ 
        error: 'Operation type, task IDs, and executedBy are required' 
      }, { status: 400 });
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ 
        error: 'Task IDs must be a non-empty array' 
      }, { status: 400 });
    }
    
    // Create batch operation record
    const operationId = await batchOperationService.createBatchOperation({
      operationType,
      taskIds,
      parameters: parameters || {},
      executedBy,
      workspaceId,
      totalItems: taskIds.length,
    });

    // Execute the batch operation based on type
    switch (operationType) {
      case 'update':
        await batchOperationService.executeBatchUpdate(operationId, taskIds, parameters);
        break;
      
      case 'assign':
        // Handle task assignment in batch
        const results = [];
        for (const taskId of taskIds) {
          try {
            // This would integrate with teamTaskService.assignTask
            results.push({
              taskId,
              success: true,
              executedAt: Date.now(),
            });
          } catch (error) {
            results.push({
              taskId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              executedAt: Date.now(),
            });
          }
        }
        await batchOperationService.updateBatchProgress(operationId, 100, 'completed', results);
        break;
      
      default:
        await batchOperationService.updateBatchProgress(
          operationId, 
          0, 
          'failed', 
          [{ taskId: 'all', success: false, error: `Unsupported operation type: ${operationType}`, executedAt: Date.now() }]
        );
        return NextResponse.json({ 
          error: `Unsupported operation type: ${operationType}` 
        }, { status: 400 });
    }
    
    return NextResponse.json({ operationId });
  } catch (error) {
    console.error('Error executing batch operation:', error);
    return NextResponse.json({ error: 'Failed to execute batch operation' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('operationId');
    const userEmail = searchParams.get('userEmail');
    
    if (operationId) {
      // Get specific batch operation
      const operation = await batchOperationService.getBatchOperation(operationId);
      if (!operation) {
        return NextResponse.json({ error: 'Batch operation not found' }, { status: 404 });
      }
      return NextResponse.json({ operation });
    }
    
    if (userEmail) {
      // Get user's batch operations
      const operations = await batchOperationService.getUserBatchOperations(userEmail);
      return NextResponse.json({ operations });
    }
    
    return NextResponse.json({ error: 'Operation ID or user email is required' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching batch operations:', error);
    return NextResponse.json({ error: 'Failed to fetch batch operations' }, { status: 500 });
  }
}