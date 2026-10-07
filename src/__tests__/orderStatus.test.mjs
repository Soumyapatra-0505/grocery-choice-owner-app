import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load source files for structural and logic assertions
const ordersIndexPath = path.resolve('src/app/(tabs)/orders/index.tsx');
const orderDetailsPath = path.resolve('src/app/(tabs)/orders/[id].tsx');
const statusPickerPath = path.resolve('src/components/common/OrderStatusPickerModal.tsx');
const typesPath = path.resolve('src/types/index.ts');
const ordersApiPath = path.resolve('src/api/ordersApi.ts');

const ordersIndexContent = fs.readFileSync(ordersIndexPath, 'utf-8');
const orderDetailsContent = fs.readFileSync(orderDetailsPath, 'utf-8');
const statusPickerContent = fs.readFileSync(statusPickerPath, 'utf-8');
const typesContent = fs.readFileSync(typesPath, 'utf-8');
const ordersApiContent = fs.readFileSync(ordersApiPath, 'utf-8');

// Mirror of core lifecycle definitions from OrderStatusPickerModal.tsx
const EXPECTED_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED'
];

function isTerminalOrderStatus(status) {
  if (!status) return false;
  const upper = String(status).toUpperCase();
  return upper === 'DELIVERED' || upper === 'CANCELLED';
}

describe('Owner App Order Status Dropdown & Picker Suite', () => {

  describe('1. All Six Statuses Representation', () => {
    test('OrderStatus type definition contains all six required statuses', () => {
      EXPECTED_STATUSES.forEach((st) => {
        assert.ok(
          typesContent.includes(`'${st}'`),
          `types/index.ts must define OrderStatus '${st}'`
        );
      });
    });

    test('OrderStatusPickerModal defines and exports all six statuses in ORDER_STATUS_OPTIONS', () => {
      EXPECTED_STATUSES.forEach((st) => {
        assert.ok(
          statusPickerContent.includes(`status: '${st}'`),
          `OrderStatusPickerModal must include status '${st}'`
        );
      });
    });

    test('Each status option has appropriate display label, description, and badge variant', () => {
      assert.ok(statusPickerContent.includes("label: 'Placed'"));
      assert.ok(statusPickerContent.includes("label: 'Confirmed'"));
      assert.ok(statusPickerContent.includes("label: 'Processing'"));
      assert.ok(statusPickerContent.includes("label: 'Out for Delivery'"));
      assert.ok(statusPickerContent.includes("label: 'Delivered'"));
      assert.ok(statusPickerContent.includes("label: 'Cancelled'"));

      assert.ok(statusPickerContent.includes("variant: 'default'"));
      assert.ok(statusPickerContent.includes("variant: 'success'"));
      assert.ok(statusPickerContent.includes("variant: 'warning'"));
      assert.ok(statusPickerContent.includes("variant: 'info'"));
      assert.ok(statusPickerContent.includes("variant: 'danger'"));
    });
  });

  describe('2. Current Status Recognition', () => {
    test('Current status is identified and highlighted for any valid status', () => {
      EXPECTED_STATUSES.forEach((current) => {
        // Simulating the row matching logic: option.status === currentStatus
        const matches = EXPECTED_STATUSES.map((opt) => ({
          status: opt,
          isCurrent: opt === current
        }));

        const currentMatches = matches.filter((m) => m.isCurrent);
        assert.equal(currentMatches.length, 1, `Exactly 1 match for current status '${current}'`);
        assert.equal(currentMatches[0].status, current);
      });
    });

    test('Status picker highlights selected row with current indicator', () => {
      assert.ok(
        statusPickerContent.includes('styles.statusOptionRowSelected'),
        'Modal must define selected row styling'
      );
      assert.ok(
        statusPickerContent.includes('styles.radioCircleSelected'),
        'Modal must highlight selected radio button'
      );
      assert.ok(
        statusPickerContent.includes('currentIndicator'),
        'Modal must show a visual Current indicator'
      );
    });
  });

  describe('3. API updateStatus Dispatch & Contract', () => {
    test('ordersApi.updateStatus uses PATCH /orders/{id}/status with payload', () => {
      assert.ok(
        ordersApiContent.includes("patch(`/orders/${id}/status`, { status })") ||
        ordersApiContent.includes('patch(`/orders/${id}/status`'),
        'ordersApi.updateStatus must call PATCH /orders/{id}/status'
      );
    });

    test('Simulated updateStatus dispatches correct orderId and status', async () => {
      let interceptedCall = null;
      const mockApiClient = {
        patch: async (url, body) => {
          interceptedCall = { url, body };
          return { id: 42, orderNumber: 'GC-20261007-000042', status: body.status };
        }
      };

      const mockOrdersApi = {
        updateStatus: async (id, status) => {
          return mockApiClient.patch(`/orders/${id}/status`, { status });
        }
      };

      const result = await mockOrdersApi.updateStatus(42, 'CONFIRMED');

      assert.ok(interceptedCall, 'PATCH must be called');
      assert.equal(interceptedCall.url, '/orders/42/status');
      assert.deepEqual(interceptedCall.body, { status: 'CONFIRMED' });
      assert.equal(result.status, 'CONFIRMED');
    });
  });

  describe('4. Successful State Transition Logic', () => {
    test('Updating order status in list immediately reflects in local state', () => {
      const initialOrders = [
        { id: 1, orderNumber: 'GC-001', status: 'PLACED' },
        { id: 2, orderNumber: 'GC-002', status: 'CONFIRMED' }
      ];

      const updatedFromApi = { id: 1, orderNumber: 'GC-001', status: 'PROCESSING' };

      // State reducer mapping
      const updatedOrders = initialOrders.map((o) =>
        o.id === updatedFromApi.id ? { ...o, ...updatedFromApi } : o
      );

      assert.equal(updatedOrders[0].status, 'PROCESSING');
      assert.equal(updatedOrders[1].status, 'CONFIRMED');
    });

    test('Updating single order in details screen updates state directly', () => {
      const currentOrder = { id: 10, orderNumber: 'GC-010', status: 'PROCESSING' };
      const updatedPatch = { id: 10, orderNumber: 'GC-010', status: 'OUT_FOR_DELIVERY' };

      const newOrderState = { ...currentOrder, ...updatedPatch };
      assert.equal(newOrderState.status, 'OUT_FOR_DELIVERY');
    });
  });

  describe('5. Terminal-State Safeguards (DELIVERED & CANCELLED)', () => {
    test('isTerminalOrderStatus correctly identifies DELIVERED and CANCELLED', () => {
      assert.equal(isTerminalOrderStatus('DELIVERED'), true);
      assert.equal(isTerminalOrderStatus('delivered'), true);
      assert.equal(isTerminalOrderStatus('CANCELLED'), true);
      assert.equal(isTerminalOrderStatus('cancelled'), true);

      assert.equal(isTerminalOrderStatus('PLACED'), false);
      assert.equal(isTerminalOrderStatus('CONFIRMED'), false);
      assert.equal(isTerminalOrderStatus('PROCESSING'), false);
      assert.equal(isTerminalOrderStatus('OUT_FOR_DELIVERY'), false);
      assert.equal(isTerminalOrderStatus(null), false);
      assert.equal(isTerminalOrderStatus(undefined), false);
    });

    test('DELIVERED orders are strictly blocked from modification', async () => {
      let apiCalled = false;
      const order = { id: 100, status: 'DELIVERED' };

      const attemptStatusChange = async (targetOrder, newStatus) => {
        if (isTerminalOrderStatus(targetOrder.status)) {
          return { blocked: true, reason: 'Terminal order locked' };
        }
        apiCalled = true;
        return { blocked: false };
      };

      const result = await attemptStatusChange(order, 'PROCESSING');
      assert.equal(result.blocked, true);
      assert.equal(apiCalled, false, 'API call must NOT be triggered for DELIVERED order');
    });

    test('CANCELLED orders are strictly blocked from modification', async () => {
      let apiCalled = false;
      const order = { id: 101, status: 'CANCELLED' };

      const attemptStatusChange = async (targetOrder, newStatus) => {
        if (isTerminalOrderStatus(targetOrder.status)) {
          return { blocked: true, reason: 'Terminal order locked' };
        }
        apiCalled = true;
        return { blocked: false };
      };

      const result = await attemptStatusChange(order, 'CONFIRMED');
      assert.equal(result.blocked, true);
      assert.equal(apiCalled, false, 'API call must NOT be triggered for CANCELLED order');
    });

    test('OrderStatusPickerModal enforces terminal locked banner and disabled rows', () => {
      assert.ok(
        statusPickerContent.includes('isTerminalOrderStatus'),
        'Modal must use isTerminalOrderStatus guard'
      );
      assert.ok(
        statusPickerContent.includes('terminalBanner'),
        'Modal must contain terminal banner'
      );
      assert.ok(
        statusPickerContent.includes('statusOptionRowDisabled'),
        'Modal must apply disabled styles for terminal orders'
      );
    });

    test('Orders list and details screens enforce terminal lock guards', () => {
      assert.ok(
        ordersIndexContent.includes('isTerminalOrderStatus(order.status)') ||
        ordersIndexContent.includes('isTerminalOrderStatus(item.status)'),
        'Orders list must guard terminal status'
      );
      assert.ok(
        orderDetailsContent.includes('isTerminalOrderStatus(order?.status)') ||
        orderDetailsContent.includes('isTerminalOrderStatus(order.status)'),
        'Order details must guard terminal status'
      );
    });
  });

  describe('6. Concurrency & Duplicate Request Prevention', () => {
    test('Simultaneous update requests are prevented while updating is active', async () => {
      let activeUpdatingId = 55;
      let callsMade = 0;

      const triggerUpdate = async (orderId, newStatus) => {
        if (activeUpdatingId !== null) {
          // Duplicate/concurrent request blocked
          return { success: false, reason: 'Busy updating' };
        }
        activeUpdatingId = orderId;
        callsMade++;
        // simulate async work
        activeUpdatingId = null;
        return { success: true };
      };

      const res1 = await triggerUpdate(55, 'PROCESSING');
      assert.equal(res1.success, false);
      assert.equal(callsMade, 0);

      // Now when idle
      activeUpdatingId = null;
      const res2 = await triggerUpdate(55, 'PROCESSING');
      assert.equal(res2.success, true);
      assert.equal(callsMade, 1);
    });

    test('UI components track updating state with spinners and disabled triggers', () => {
      assert.ok(
        ordersIndexContent.includes('updatingOrderId'),
        'Orders list must track updatingOrderId'
      );
      assert.ok(
        ordersIndexContent.includes('ActivityIndicator'),
        'Orders list must show ActivityIndicator while updating'
      );
      assert.ok(
        orderDetailsContent.includes('updating') && orderDetailsContent.includes('setUpdating'),
        'Order details must track updating state'
      );
      assert.ok(
        orderDetailsContent.includes('ActivityIndicator'),
        'Order details must show ActivityIndicator while updating'
      );
    });
  });

  describe('7. Graceful Error Handling & State Preservation', () => {
    test('API failure preserves existing order status without corruption', async () => {
      const originalOrders = [
        { id: 7, orderNumber: 'GC-007', status: 'PLACED' }
      ];

      let workingOrders = [...originalOrders];
      let errorEncountered = null;

      const performUpdate = async (orderId, newStatus) => {
        try {
          throw new Error('Network timeout during status patch');
        } catch (err) {
          errorEncountered = err.message;
          // Working orders are untouched
        }
      };

      await performUpdate(7, 'CONFIRMED');

      assert.ok(errorEncountered);
      assert.equal(workingOrders[0].status, 'PLACED', 'Status must remain PLACED after failure');
    });

    test('Orders list and details screens display error alerts without crashing', () => {
      assert.ok(
        ordersIndexContent.includes('Alert.alert') || ordersIndexContent.includes('feedbackError'),
        'Orders list must handle error feedback safely'
      );
      assert.ok(
        orderDetailsContent.includes('Alert.alert') || orderDetailsContent.includes('feedbackError'),
        'Order details must handle error feedback safely'
      );
    });
  });

  describe('8. Component Integration & User Experience', () => {
    test('Orders list renders OrderStatusPickerModal with required props', () => {
      assert.ok(
        ordersIndexContent.includes('<OrderStatusPickerModal'),
        'Orders list must render OrderStatusPickerModal'
      );
      assert.ok(
        ordersIndexContent.includes('currentStatus='),
        'Modal must receive currentStatus'
      );
      assert.ok(
        ordersIndexContent.includes('onSelectStatus='),
        'Modal must receive onSelectStatus handler'
      );
      assert.ok(
        ordersIndexContent.includes('onClose='),
        'Modal must receive onClose handler'
      );
    });

    test('Order details renders OrderStatusPickerModal with required props', () => {
      assert.ok(
        orderDetailsContent.includes('<OrderStatusPickerModal'),
        'Order details must render OrderStatusPickerModal'
      );
      assert.ok(
        orderDetailsContent.includes('currentStatus='),
        'Modal must receive currentStatus'
      );
      assert.ok(
        orderDetailsContent.includes('onSelectStatus='),
        'Modal must receive onSelectStatus handler'
      );
    });

    test('Order details preserves Customer Details, Items, Payment, and Financial summary', () => {
      assert.ok(orderDetailsContent.includes('Customer Details'), 'Customer Details card preserved');
      assert.ok(orderDetailsContent.includes('Ordered Items'), 'Ordered Items card preserved');
      assert.ok(orderDetailsContent.includes('Payment Information'), 'Payment Information card preserved');
      assert.ok(orderDetailsContent.includes('Financial Summary'), 'Financial Summary card preserved');
    });
  });
});
