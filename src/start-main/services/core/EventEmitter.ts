/**
 * EventEmitter - Centralized pub/sub system for inter-service communication
 *
 * Single Responsibility: Manage event subscriptions and emissions
 *
 * This allows services to communicate without direct dependencies,
 * promoting loose coupling and easier testing.
 */

type Listener = (data: any) => void;

class EventEmitter {
  private _events: Map<string, Listener[]>;

  constructor() {
    this._events = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event: string, callback: Listener): () => void {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }

    const listeners = this._events.get(event)!;
    listeners.push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function to remove
   */
  off(event: string, callback: Listener): void {
    if (!this._events.has(event)) {
      return;
    }

    const listeners = this._events.get(event)!;
    const index = listeners.indexOf(callback);

    if (index > -1) {
      listeners.splice(index, 1);
    }

    // Clean up empty event arrays
    if (listeners.length === 0) {
      this._events.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {*} data - Data to pass to subscribers
   */
  emit(event: string, data?: any): void {
    if (!this._events.has(event)) {
      return;
    }

    const listeners = this._events.get(event)!;

    // Create a copy to avoid issues if listeners unsubscribe during emission
    const listenersCopy = [...listeners];

    for (const callback of listenersCopy) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error);
      }
    }
  }

  /**
   * Remove all listeners for an event (or all events)
   * @param {string} [event] - Event name (optional, if not provided clears all)
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event: string): number {
    if (!this._events.has(event)) {
      return 0;
    }
    return this._events.get(event)!.length;
  }
}

export default EventEmitter;
