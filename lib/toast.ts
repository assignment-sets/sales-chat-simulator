import { toast } from "sonner";

/**
 * Standardized application toast notification helper.
 * Provides consistent user feedback with zero layout shifts.
 */
export const notify = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 3500,
    });
  },

  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 4000,
    });
  },

  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 3500,
    });
  },

  warning: (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
    });
  },

  dismiss: (id?: string | number) => {
    toast.dismiss(id);
  },
};
