import { useEffect, type RefObject } from 'react';

type Event = MouseEvent | TouchEvent;
type Handler = (event: Event) => void;

function useOnClickOutside<T extends HTMLElement = HTMLElement>(
    ref: RefObject<T | null> | null,
    handler: Handler,
    mouseEvent: 'mousedown' | 'mouseup' = 'mousedown',
): void {
    useEffect(() => {
        const listener = (event: Event) => {
            const el = ref?.current;
            // Do nothing if clicking ref's element or descendent elements
            if (!el || el.contains((event?.target as Node) || null)) {
                return;
            }

            handler(event);
        };

        document.addEventListener(mouseEvent, listener);
        document.addEventListener('touchstart', listener);

        return () => {
            document.removeEventListener(mouseEvent, listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler, mouseEvent]);
}

export default useOnClickOutside;
