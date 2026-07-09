import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

// Le pagine dell'app sono racchiuse in un motion.div animato (transizione tab in App.tsx): un
// qualsiasi elemento con transform applicato diventa containing block per i figli position:fixed,
// quindi una modale annidata li' dentro non si centra piu' sul viewport ma sul box del wrapper
// animato (segue lo scroll interno di .main-content). Il fix reale e' un portal diretto su <body>,
// fuori da qualsiasi antenato con transform: da qui in poi "fixed" torna a significare "sul viewport".
export const ModalPortal = ({ children }: { children: React.ReactNode }) => (
  typeof document !== 'undefined' ? createPortal(children, document.body) : null
);

let scrollLockCount = 0;
let previousBodyOverflow = '';
let previousMainOverflow = '';

const lockScroll = () => {
  if (scrollLockCount === 0) {
    const mainContent = document.querySelector('.main-content') as HTMLElement | null;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (mainContent) {
      previousMainOverflow = mainContent.style.overflow;
      mainContent.style.overflow = 'hidden';
    }
  }
  scrollLockCount += 1;
};

const unlockScroll = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    const mainContent = document.querySelector('.main-content') as HTMLElement | null;
    if (mainContent) mainContent.style.overflow = previousMainOverflow;
  }
};

// Blocco scroll body/.main-content (ref-counted: piu' modali aperte insieme non si "sbloccano" a
// vicenda) + chiusura con Esc. Riutilizzabile anche dalle modali che gia' hanno il proprio markup
// (basta chiamarlo, nessuna riscrittura del layout esistente). `active` va passato esplicitamente
// (mai un return anticipato prima dell'hook): molte modali sono componenti sempre montati che
// ritornano null internamente quando chiusi, e un hook saltato in quel caso violerebbe le regole
// degli hook.
export const useModalBehavior = (active: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockScroll();
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
};

interface BaseModalProps {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  zIndex?: number;
  ariaLabel?: string;
  labelledBy?: string;
  showCloseButton?: boolean;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
}

// Wrapper riutilizzabile: overlay fisso via portal, contenuto centrato con scroll interno, Esc/
// click-overlay per chiudere, click interno che non chiude, focus iniziale, role="dialog".
export default function BaseModal({
  onClose,
  children,
  maxWidth = '560px',
  zIndex = 4000,
  ariaLabel,
  labelledBy,
  showCloseButton = true,
  contentClassName = '',
  contentStyle
}: BaseModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  useModalBehavior(true, onClose);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  return (
    <ModalPortal>
      <div className="ui-modal-backdrop" style={{ zIndex }} onClick={onClose}>
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`ui-modal-content ${contentClassName}`}
          style={{ width: maxWidth, ...contentStyle }}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          tabIndex={-1}
          onClick={event => event.stopPropagation()}
        >
          {showCloseButton && (
            <button type="button" className="ui-modal-close" aria-label="Chiudi" onClick={onClose}>
              <X size={16} />
            </button>
          )}
          {children}
        </motion.div>
      </div>
    </ModalPortal>
  );
}
