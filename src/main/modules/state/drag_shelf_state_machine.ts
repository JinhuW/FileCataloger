import { EventEmitter } from 'events';
import { createLogger, Logger } from '../utils/logger';

/**
 * States for the drag/shelf lifecycle
 */
export enum DragShelfState {
  IDLE = 'idle',
  DRAG_STARTED = 'drag_started',
  SHELF_CREATING = 'shelf_creating',
  SHELF_ACTIVE = 'shelf_active',
  SHELF_RECEIVING_DROP = 'shelf_receiving_drop',
  SHELF_AUTO_HIDE_SCHEDULED = 'shelf_auto_hide_scheduled',
  CLEANUP_IN_PROGRESS = 'cleanup_in_progress',
}

/**
 * Events that can trigger state transitions
 */
export enum DragShelfEvent {
  START_DRAG = 'start_drag',
  END_DRAG = 'end_drag',
  SHAKE_DETECTED = 'shake_detected',
  SHELF_CREATED = 'shelf_created',
  DROP_STARTED = 'drop_started',
  DROP_ENDED = 'drop_ended',
  ITEMS_ADDED = 'items_added',
  ITEMS_REMOVED = 'items_removed',
  AUTO_HIDE_TRIGGERED = 'auto_hide_triggered',
  CLEANUP_COMPLETE = 'cleanup_complete',
}

/**
 * Context data for the state machine
 */
export interface DragShelfContext {
  isDragging: boolean;
  activeShelfId: string | null;
  hasItems: boolean;
  dropInProgress: boolean;
  autoHideScheduled: boolean;
}

/**
 * State transition definition
 */
interface StateTransition {
  from: DragShelfState;
  event: DragShelfEvent;
  to: DragShelfState;
  guard?: (context: DragShelfContext) => boolean;
  action?: (context: DragShelfContext) => void;
}

/**
 * State machine for managing drag and shelf lifecycle
 */
export class DragShelfStateMachine extends EventEmitter {
  private currentState: DragShelfState = DragShelfState.IDLE;
  private context: DragShelfContext = {
    isDragging: false,
    activeShelfId: null,
    hasItems: false,
    dropInProgress: false,
    autoHideScheduled: false,
  };
  private logger: Logger;

  /**
   * State transition table
   */
  private transitions: StateTransition[] = [
    // Idle transitions
    {
      from: DragShelfState.IDLE,
      event: DragShelfEvent.START_DRAG,
      to: DragShelfState.DRAG_STARTED,
      action: ctx => {
        ctx.isDragging = true;
      },
    },

    // Drag started transitions
    {
      from: DragShelfState.DRAG_STARTED,
      event: DragShelfEvent.END_DRAG,
      to: DragShelfState.CLEANUP_IN_PROGRESS,
      guard: ctx => !ctx.activeShelfId,
      action: ctx => {
        ctx.isDragging = false;
      },
    },
    {
      from: DragShelfState.DRAG_STARTED,
      event: DragShelfEvent.END_DRAG,
      to: DragShelfState.IDLE,
      guard: ctx => ctx.activeShelfId !== null,
      action: ctx => {
        ctx.isDragging = false;
      },
    },
    {
      from: DragShelfState.DRAG_STARTED,
      event: DragShelfEvent.SHAKE_DETECTED,
      to: DragShelfState.SHELF_CREATING,
    },
    {
      from: DragShelfState.DRAG_STARTED,
      event: DragShelfEvent.START_DRAG,
      to: DragShelfState.DRAG_STARTED,
      action: ctx => {
        // Stay in drag_started state for repeated drag events
        ctx.isDragging = true;
      },
    },

    // Shelf creating transitions
    {
      from: DragShelfState.SHELF_CREATING,
      event: DragShelfEvent.SHELF_CREATED,
      to: DragShelfState.SHELF_ACTIVE,
      action: ctx => {
        ctx.activeShelfId = this.getEventData('shelfId') as string;
      },
    },

    // Shelf active transitions
    {
      from: DragShelfState.SHELF_ACTIVE,
      event: DragShelfEvent.DROP_STARTED,
      to: DragShelfState.SHELF_RECEIVING_DROP,
      action: ctx => {
        ctx.dropInProgress = true;
      },
    },
    {
      from: DragShelfState.SHELF_ACTIVE,
      event: DragShelfEvent.ITEMS_ADDED,
      to: DragShelfState.SHELF_ACTIVE,
      action: ctx => {
        ctx.hasItems = true;
      },
    },
    {
      from: DragShelfState.SHELF_ACTIVE,
      event: DragShelfEvent.END_DRAG,
      to: DragShelfState.SHELF_AUTO_HIDE_SCHEDULED,
      guard: ctx => !ctx.hasItems && !ctx.dropInProgress,
      action: ctx => {
        ctx.isDragging = false;
        ctx.autoHideScheduled = true;
      },
    },
    {
      from: DragShelfState.SHELF_ACTIVE,
      event: DragShelfEvent.END_DRAG,
      to: DragShelfState.SHELF_ACTIVE,
      guard: ctx => ctx.hasItems || ctx.dropInProgress,
      action: ctx => {
        ctx.isDragging = false;
      },
    },

    // Shelf receiving drop transitions
    {
      from: DragShelfState.SHELF_RECEIVING_DROP,
      event: DragShelfEvent.ITEMS_ADDED,
      to: DragShelfState.SHELF_ACTIVE,
      action: ctx => {
        ctx.hasItems = true;
        ctx.dropInProgress = false;
      },
    },
    {
      from: DragShelfState.SHELF_RECEIVING_DROP,
      event: DragShelfEvent.DROP_ENDED,
      to: DragShelfState.SHELF_ACTIVE,
      action: ctx => {
        ctx.dropInProgress = false;
      },
    },

    // Additional shelf active transitions for drop_ended
    {
      from: DragShelfState.SHELF_ACTIVE,
      event: DragShelfEvent.DROP_ENDED,
      to: DragShelfState.SHELF_ACTIVE,
      action: ctx => {
        ctx.dropInProgress = false;
      },
    },

    // Auto-hide scheduled transitions
    {
      from: DragShelfState.SHELF_AUTO_HIDE_SCHEDULED,
      event: DragShelfEvent.AUTO_HIDE_TRIGGERED,
      to: DragShelfState.CLEANUP_IN_PROGRESS,
    },
    {
      from: DragShelfState.SHELF_AUTO_HIDE_SCHEDULED,
      event: DragShelfEvent.START_DRAG,
      to: DragShelfState.SHELF_ACTIVE,
      action: ctx => {
        ctx.isDragging = true;
        ctx.autoHideScheduled = false;
      },
    },
    {
      from: DragShelfState.SHELF_AUTO_HIDE_SCHEDULED,
      event: DragShelfEvent.ITEMS_ADDED,
      to: DragShelfState.SHELF_ACTIVE,
      action: ctx => {
        ctx.hasItems = true;
        ctx.autoHideScheduled = false;
      },
    },

    // Cleanup transitions
    {
      from: DragShelfState.CLEANUP_IN_PROGRESS,
      event: DragShelfEvent.CLEANUP_COMPLETE,
      to: DragShelfState.IDLE,
      action: ctx => {
        // Reset context
        ctx.isDragging = false;
        ctx.activeShelfId = null;
        ctx.hasItems = false;
        ctx.dropInProgress = false;
        ctx.autoHideScheduled = false;
      },
    },
    {
      from: DragShelfState.CLEANUP_IN_PROGRESS,
      event: DragShelfEvent.START_DRAG,
      to: DragShelfState.DRAG_STARTED,
      action: ctx => {
        ctx.isDragging = true;
        // Don't reset other context - let cleanup complete naturally
      },
    },
    {
      from: DragShelfState.CLEANUP_IN_PROGRESS,
      event: DragShelfEvent.END_DRAG,
      to: DragShelfState.CLEANUP_IN_PROGRESS,
      action: ctx => {
        ctx.isDragging = false;
      },
    },
    {
      from: DragShelfState.SHELF_ACTIVE,
      event: DragShelfEvent.START_DRAG,
      to: DragShelfState.DRAG_STARTED,
      action: ctx => {
        ctx.isDragging = true;
        // Keep activeShelfId to allow multiple shelves
      },
    },
    {
      from: DragShelfState.SHELF_AUTO_HIDE_SCHEDULED,
      event: DragShelfEvent.SHAKE_DETECTED,
      to: DragShelfState.SHELF_CREATING,
      guard: ctx => ctx.isDragging,
    },
    {
      from: DragShelfState.SHELF_ACTIVE,
      event: DragShelfEvent.SHAKE_DETECTED,
      to: DragShelfState.SHELF_CREATING,
      guard: ctx => ctx.isDragging,
    },
    {
      from: DragShelfState.SHELF_CREATING,
      event: DragShelfEvent.END_DRAG,
      to: DragShelfState.SHELF_AUTO_HIDE_SCHEDULED,
      action: ctx => {
        ctx.isDragging = false;
      },
    },
    {
      from: DragShelfState.SHELF_AUTO_HIDE_SCHEDULED,
      event: DragShelfEvent.CLEANUP_COMPLETE,
      to: DragShelfState.IDLE,
      action: ctx => {
        ctx.isDragging = false;
        ctx.activeShelfId = null;
        ctx.hasItems = false;
        ctx.dropInProgress = false;
        ctx.autoHideScheduled = false;
      },
    },
  ];

  private eventData: Record<string, unknown> = {};

  constructor() {
    super();
    this.logger = createLogger('DragShelfStateMachine');
  }

  /**
   * Get current state
   */
  public getState(): DragShelfState {
    return this.currentState;
  }

  /**
   * Get context
   */
  public getContext(): Readonly<DragShelfContext> {
    return { ...this.context };
  }

  /**
   * Send an event to the state machine
   */
  public send(event: DragShelfEvent, data?: Record<string, unknown>): boolean {
    this.eventData = data || {};

    const transition = this.findTransition(this.currentState, event);

    if (!transition) {
      this.logger.warn(
        `🚫 BLOCKED STATE TRANSITION: No transition found for event '${event}' from state '${this.currentState}'`
      );
      this.logger.info(
        `📊 Current context: activeShelfId=${this.context.activeShelfId}, isDragging=${this.context.isDragging}`
      );
      return false;
    }

    // Check guard condition
    if (transition.guard && !transition.guard(this.context)) {
      this.logger.warn(
        `🚫 GUARD FAILED: Transition from '${this.currentState}' to '${transition.to}' blocked by guard condition`
      );
      this.logger.info(
        `📊 Context at guard check: activeShelfId=${this.context.activeShelfId}, isDragging=${this.context.isDragging}`
      );
      return false;
    }

    // Execute action
    if (transition.action) {
      transition.action(this.context);
    }

    const previousState = this.currentState;
    this.currentState = transition.to;

    this.logger.info(
      `🔄 STATE TRANSITION: ${previousState} → ${this.currentState} (event: ${event})`
    );
    this.logger.debug(
      `📊 Updated context: activeShelfId=${this.context.activeShelfId}, isDragging=${this.context.isDragging}`
    );

    // Emit state change event
    this.emit('stateChanged', {
      previousState,
      currentState: this.currentState,
      event,
      context: this.getContext(),
    });

    return true;
  }

  /**
   * Check if an event can be handled in current state
   */
  public canHandle(event: DragShelfEvent): boolean {
    const transition = this.findTransition(this.currentState, event);
    return transition !== null && (!transition.guard || transition.guard(this.context));
  }

  /**
   * Find transition for given state and event
   */
  private findTransition(state: DragShelfState, event: DragShelfEvent): StateTransition | null {
    return this.transitions.find(t => t.from === state && t.event === event) || null;
  }

  /**
   * Get event data (used in actions)
   */
  private getEventData(key: string): unknown {
    return this.eventData[key];
  }

  /**
   * Reset state machine to initial state
   */
  public reset(): void {
    this.currentState = DragShelfState.IDLE;
    this.context = {
      isDragging: false,
      activeShelfId: null,
      hasItems: false,
      dropInProgress: false,
      autoHideScheduled: false,
    };
    this.eventData = {};
    this.logger.info('State machine reset to IDLE');
  }

  /**
   * Helper methods for common state checks
   */
  public isIdle(): boolean {
    return this.currentState === DragShelfState.IDLE;
  }

  public isDragging(): boolean {
    return this.context.isDragging;
  }

  public hasActiveShelf(): boolean {
    return this.context.activeShelfId !== null;
  }

  public isShelfActive(): boolean {
    return this.currentState === DragShelfState.SHELF_ACTIVE;
  }

  public isReceivingDrop(): boolean {
    return this.currentState === DragShelfState.SHELF_RECEIVING_DROP;
  }

  public canCreateShelf(): boolean {
    // Allow shelf creation when dragging, regardless of existing shelves
    // This supports multiple concurrent shelves (up to 5 total)
    const canCreate =
      this.context.isDragging &&
      (this.currentState === DragShelfState.DRAG_STARTED ||
        this.currentState === DragShelfState.SHELF_ACTIVE ||
        this.currentState === DragShelfState.SHELF_AUTO_HIDE_SCHEDULED);
    this.logger.debug(
      `🔍 canCreateShelf(): ${canCreate} (state: ${this.currentState}, isDragging: ${this.context.isDragging}, activeShelfId: ${this.context.activeShelfId})`
    );
    return canCreate;
  }
}
