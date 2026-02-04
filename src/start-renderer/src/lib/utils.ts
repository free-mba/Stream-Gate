import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export async function copyToClipboard(text: string): Promise<boolean> {
    if (!navigator.clipboard) {
        console.warn('Clipboard API not available');
        return false;
    }
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text', err);
        return false;
    }
}
