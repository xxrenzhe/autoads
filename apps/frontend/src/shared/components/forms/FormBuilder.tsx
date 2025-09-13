"use client";

import React from 'react';
import { useForm, Controller, FieldValues, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

// Field types supported by the form builder
export type FieldType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'number' 
  | 'textarea' 
  | 'select' 
  | 'checkbox' 
  | 'radio' 
  | 'date' 
  | 'file';

// Base field configuration
export interface BaseFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  description?: string;
  className?: string;
}

// Specific field configurations
export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text' | 'email' | 'password';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}

export interface TextareaFieldConfig extends BaseFieldConfig {
  type: 'textarea';
  rows?: number;
  minLength?: number;
  maxLength?: number;
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  multiple?: boolean;
}

export interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox';
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
}

export interface RadioFieldConfig extends BaseFieldConfig {
  type: 'radio';
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export interface DateFieldConfig extends BaseFieldConfig {
  type: 'date';
  min?: string;
  max?: string;
}

export interface FileFieldConfig extends BaseFieldConfig {
  type: 'file';
  accept?: string;
  multiple?: boolean;
}

export type FieldConfig = 
  | TextFieldConfig 
  | NumberFieldConfig 
  | TextareaFieldConfig 
  | SelectFieldConfig 
  | CheckboxFieldConfig 
  | RadioFieldConfig 
  | DateFieldConfig 
  | FileFieldConfig;

// Form section for grouping fields
export interface FormSection {
  title?: string;
  description?: string;
  fields: FieldConfig[];
  className?: string;
}

// Form builder props
export interface FormBuilderProps<T extends FieldValues = FieldValues> {
  sections: FormSection[];
  schema?: z.ZodSchema<T>;
  defaultValues?: Partial<T>;
  onSubmit: (data: T) => void | Promise<void>;
  submitLabel?: string;
  resetLabel?: string;
  showReset?: boolean;
  loading?: boolean;
  className?: string;
  layout?: 'vertical' | 'horizontal';
}

// Field component renderer
function FieldRenderer<T extends FieldValues>({
  field,
  control,
  errors,
  layout = 'vertical'
}: {
  field: FieldConfig;
  control: any;
  errors: any;
  layout?: 'vertical' | 'horizontal';
}) => {
  const error = errors[field.name];
  const fieldId = `field-${field.name}`;

  const renderField = () => {
    switch (field.type) => {
      case 'text':
      case 'email':
      case 'password':
        return (
          <Controller
            name={field.name as Path<T>}
            control={control}
            render={({ field: controllerField }) => (
              <Input
                {...controllerField}
                id={fieldId}
                type={field.type}
                placeholder={field.placeholder}
                disabled={field.disabled}
                className={clsx(error && "border-red-500", field.className)}
              />
            )}
          />
        );

      case 'number':
        const numberField = field as NumberFieldConfig;
        return (
          <Controller
            name={field.name as Path<T>}
            control={control}
            render={({ field: controllerField }) => (
              <Input
                {...controllerField}
                id={fieldId}
                type="number"
                placeholder={field.placeholder}
                disabled={field.disabled}
                min={numberField.min}
                max={numberField.max}
                step={numberField.step}
                className={clsx(error && "border-red-500", field.className)}
                onChange={(e) => controllerField.onChange(Number(e.target.value))}
              />
            )}
          />
        );

      case 'textarea':
        const textareaField = field as TextareaFieldConfig;
        return (
          <Controller
            name={field.name as Path<T>}
            control={control}
            render={({ field: controllerField }) => (
              <textarea
                {...controllerField}
                id={fieldId}
                placeholder={field.placeholder}
                disabled={field.disabled}
                rows={textareaField.rows || 3}
                className={clsx(
                  "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  error && "border-red-500",
                  field.disabled && "bg-gray-50 cursor-not-allowed",
                  field.className
                )}
              />
            )}
          />
        );

      case 'select':
        const selectField = field as SelectFieldConfig;
        return (
          <Controller
            name={field.name as Path<T>}
            control={control}
            render={({ field: controllerField }) => (
              <select
                {...controllerField}
                id={fieldId}
                disabled={field.disabled}
                multiple={selectField.multiple}
                className={clsx(
                  "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  error && "border-red-500",
                  field.disabled && "bg-gray-50 cursor-not-allowed",
                  field.className
                )}
              >
                <option value="">{field.placeholder || 'Select an option'}</option>
                {selectField.options.map((option: any) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />
        );

      case 'checkbox':
        const checkboxField = field as CheckboxFieldConfig;
        if (checkboxField.options) => {
          // Multiple checkboxes
          return (
            <Controller
              name={field.name as Path<T>}
              control={control}
              render={({ field: controllerField }) => (
                <div className="space-y-2">
                  {checkboxField.options!.map((option: any) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={controllerField.value?.includes(option.value)}
                        onChange={(e) => {
                          const currentValue = controllerField.value || [];
                          if (e.target.checked) => {
                            controllerField.onChange([...currentValue, option.value]);
                          } else {
                            controllerField.onChange(
                              currentValue.filter((v: string: any) => v !== option.value)
                            );
                          }
                        }}
                        disabled={field.disabled || option.disabled}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          );
        } else {
          // Single checkbox
          return (
            <Controller
              name={field.name as Path<T>}
              control={control}
              render={({ field: controllerField }) => (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={controllerField.value || false}
                    onChange={(e) => controllerField.onChange(e.target.checked)}
                    disabled={field.disabled}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{field.label}</span>
                </label>
              )}
            />
          );
        }

      case 'radio':
        const radioField = field as RadioFieldConfig;
        return (
          <Controller
            name={field.name as Path<T>}
            control={control}
            render={({ field: controllerField }) => (
              <div className="space-y-2">
                {radioField.options.map((option: any) => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="radio"
                      value={option.value}
                      checked={controllerField.value === option.value}
                      onChange={() => controllerField.onChange(option.value)}
                      disabled={field.disabled || option.disabled}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
        );

      case 'date':
        const dateField = field as DateFieldConfig;
        return (
          <Controller
            name={field.name as Path<T>}
            control={control}
            render={({ field: controllerField }) => (
              <Input
                {...controllerField}
                id={fieldId}
                type="date"
                disabled={field.disabled}
                min={dateField.min}
                max={dateField.max}
                className={clsx(error && "border-red-500", field.className)}
              />
            )}
          />
        );

      case 'file':
        const fileField = field as FileFieldConfig;
        return (
          <Controller
            name={field.name as Path<T>}
            control={control}
            render={({ field: controllerField }) => (
              <input
                type="file"
                accept={fileField.accept}
                multiple={fileField.multiple}
                disabled={field.disabled}
                onChange={(e) => {
                  const files = e.target.files;
                  controllerField.onChange(fileField.multiple ? files : files?.[0]);
                }}
                className={clsx(
                  "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  error && "border-red-500",
                  field.disabled && "bg-gray-50 cursor-not-allowed",
                  field.className
                )}
              />
            )}
          />
        );

      default:
        return null as any;
    }
  };

  const isCheckboxOnly = field.type === 'checkbox' && !(field as CheckboxFieldConfig).options;

  if (isCheckboxOnly) => {
    return (
      <div className={clsx("space-y-1", field.className)}>
        {renderField()}
        {field.description && (
          <p className="text-sm text-gray-600">{field.description}</p>
        )}
        {error && (
          <p className="text-sm text-red-600">{error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(
      layout === 'horizontal' ? "grid grid-cols-3 gap-4 items-start" : "space-y-1",
      field.className
    )}>
      <label
        htmlFor={fieldId}
        className={clsx(
          "block text-sm font-medium text-gray-700",
          layout === 'horizontal' && "pt-2"
        )}
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className={layout === 'horizontal' ? "col-span-2" : ""}>
        {renderField()}
        {field.description && (
          <p className="text-sm text-gray-600 mt-1">{field.description}</p>
        )}
        {error && (
          <p className="text-sm text-red-600 mt-1">{error.message}</p>
        )}
      </div>
    </div>
  );
}

// Main FormBuilder component
export function FormBuilder<T extends FieldValues = FieldValues>({
  sections,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = "Submit",
  resetLabel = "Reset",
  showReset = true,
  loading = false,
  className,
  layout = 'vertical'
}: FormBuilderProps<T>) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: schema ? zodResolver(schema as any) : undefined,
    defaultValues: defaultValues as any
  });

  const handleFormSubmit = async (data: any) => {
    try {
      await onSubmit(data as T);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={clsx("space-y-8", className)}
    >
      {sections.map((section, sectionIndex: any) => (
        <div key={sectionIndex} className={clsx("space-y-6", section.className)}>
          {(section.title || section.description) && (
            <div>
              {section.title && (
                <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
              )}
              {section.description && (
                <p className="text-sm text-gray-600 mt-1">{section.description}</p>
              )}
            </div>
          )}
          
          <div className="space-y-4">
            {section.fields.map((field: any) => (
              <FieldRenderer
                key={field.name}
                field={field}
                control={control}
                errors={errors}
                layout={layout}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
        {showReset && (
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={loading || isSubmitting}
          >
            {resetLabel}
          </Button>
        )}
        <Button
          type="submit"
          loading={loading || isSubmitting}
          disabled={loading || isSubmitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}