'use client';

import { Controller, useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import type { z } from 'zod';

import { adminCreateUserSchema } from '@/lib/trpc/schemas/admin';
import { USER_ROLES } from '@/lib/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type CreateUserFormValues = z.input<typeof adminCreateUserSchema>;
type CreateUserSubmitValues = z.output<typeof adminCreateUserSchema>;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserSubmitValues) => void;
  isPending: boolean;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: CreateUserDialogProps) {
  const form = useForm<CreateUserFormValues, unknown, CreateUserSubmitValues>({
    resolver: zodResolver(adminCreateUserSchema),
    defaultValues: {
      email: '',
      role: USER_ROLES.USER,
    },
  });

  const handleSubmit = (data: CreateUserSubmitValues) => {
    onSubmit(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Create a new user. They will receive an email to sign in.
          </DialogDescription>
        </DialogHeader>

        <form id="create-user-form" onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="email"
                    type="email"
                    aria-invalid={fieldState.invalid}
                    placeholder="john@example.com"
                    disabled={isPending}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="role">Is Admin</FieldLabel>
                  <FieldDescription>
                    Whether the user has administrative privileges
                  </FieldDescription>
                  <FieldContent>
                    <Switch
                      id="role"
                      checked={field.value === USER_ROLES.ADMIN}
                      onCheckedChange={(checked) => {
                        field.onChange(checked ? USER_ROLES.ADMIN : USER_ROLES.USER);
                      }}
                      disabled={isPending}
                    />
                  </FieldContent>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
