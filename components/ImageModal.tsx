'use client';

import { useEffect, useState } from 'react';

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
}

export default function ImageModal({ isOpen, onClose, imageUrl }: ImageModalProps) {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-sm cursor-zoom-out"
                onClick={() => {
                    setIsAnimating(false);
                    setTimeout(onClose, 300);
                }}
            />

            {/* Close Button */}
            <button
                onClick={() => {
                    setIsAnimating(false);
                    setTimeout(onClose, 300);
                }}
                className="absolute top-4 right-4 z-[110] p-2 text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Image Container */}
            <div
                className={`relative z-[105] max-w-full max-h-full flex items-center justify-center transition-all duration-300 transform ${isAnimating ? 'scale-100' : 'scale-95'
                    }`}
            >
                <img
                    src={imageUrl}
                    alt="Full Resolution"
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl transition-all duration-300"
                />

                {/* Helper text */}
                <div className="absolute -bottom-10 left-0 right-0 text-center">
                    <p className="text-white/60 text-sm">Click anywhere outside to close</p>
                </div>
            </div>
        </div>
    );
}
