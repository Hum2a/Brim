import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/utils.js';

const fieldClass =
  'flex h-10 w-full rounded-[2px] border border-input bg-forecourt px-3 py-2 text-sm text-pump file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput({ className, id, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const revealLabel = visible ? 'Hide password' : 'Show password';

  return (
    <div className="relative">
      <input
        {...props}
        id={id}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={cn(fieldClass, 'pr-10', className)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={revealLabel}
        aria-pressed={visible}
        {...(id ? { 'aria-controls': id } : {})}
        title={revealLabel}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-[2px] text-mist hover:text-pump focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        onClick={() => setVisible((open) => !open)}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

export function Input({ type, className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  if (type === 'password') {
    return <PasswordInput className={className} {...props} />;
  }
  return <input type={type} className={cn(fieldClass, className)} {...props} />;
}
