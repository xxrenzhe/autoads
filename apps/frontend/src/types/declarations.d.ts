// Declaration file for missing modules
declare module 'zod' {
  export const z: {
    string: () => any
    number: () => any
    boolean: () => any
    object: (shape: any) => any
    array: (schema: any) => any
    enum: (values: any) => any
    union: (schemas: any[]) => any
    optional: (schema: any) => any
    nullable: (schema: any) => any
    record: (key: any, value: any) => any
    any: () => any
    unknown: () => any
    never: () => any
    void: () => any
    literal: (value: any) => any
    tuple: (schemas: any[]) => any
    set: (schema: any) => any
    map: (keySchema: any, valueSchema: any) => any
    date: () => any
    bigint: () => any
    nativeEnum: (enumValue: any) => any
    pipeline: (schema: any, transformations: any) => any
    discriminatedUnion: (discriminator: string, options: any[]) => any
    intersection: (schemas: any[]) => any
    default: (schema: any, defaultValue: any) => any
    catch: (schema: any, defaultValue: any) => any
    transform: (schema: any, transformer: any) => any
    refine: (schema: any, refinement: any) => any
    superRefine: (schema: any, refinement: any) => any
    safeParse: (data: any) => any
    parse: (data: any) => any
  }
  export default z
}

declare module 'stripe' {
  export const Stripe: any
  export default Stripe
}

declare module '@stripe/stripe-js' {
  export const loadStripe: any
  export default loadStripe
}

declare module '@stripe/react-stripe-js' {
  export const Elements: any
  export const CardElement: any
  export const useStripe: any
  export const useElements: any
  export default { Elements, CardElement, useStripe, useElements }
}

declare module '@heroicons/react/24/outline' {
  export * from 'lucide-react'
}

declare module '@heroicons/react/24/solid' {
  export * from 'lucide-react'
}

declare module '@radix-ui/react-dialog' {
  export const Dialog: any
  export const DialogTrigger: any
  export const DialogContent: any
  export default { Dialog, DialogTrigger, DialogContent }
}

declare module '@radix-ui/react-select' {
  export const Root: React.ForwardRefExoticComponent<{
    children?: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
    defaultValue?: string
    disabled?: boolean
    required?: boolean
    name?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    [key: string]: any
  }>
  export const Group: React.ForwardRefExoticComponent<{
    children?: React.ReactNode
    [key: string]: any
  }>
  export const Value: React.ForwardRefExoticComponent<{
    placeholder?: string
    children?: React.ReactNode
    [key: string]: any
  }>
  export const Trigger: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    disabled?: boolean
    [key: string]: any
  }>
  export const Content: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    position?: 'popper' | 'item-aligned'
    side?: 'top' | 'right' | 'bottom' | 'left'
    sideOffset?: number
    align?: 'start' | 'center' | 'end'
    alignOffset?: number
    avoidCollisions?: boolean
    collisionBoundary?: any
    collisionPadding?: number
    arrowPadding?: number
    sticky?: 'partial' | 'always'
    hideWhenDetached?: boolean
    [key: string]: any
  }>
  export const Viewport: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }>
  export const Item: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    value?: string
    disabled?: boolean
    onSelect?: () => void
    [key: string]: any
  }>
  export const ItemText: React.ForwardRefExoticComponent<{
    children?: React.ReactNode
    [key: string]: any
  }>
  export const ItemIndicator: React.ForwardRefExoticComponent<{
    children?: React.ReactNode
    [key: string]: any
  }>
  export const ScrollUpButton: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }>
  export const ScrollDownButton: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }>
  export const Label: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }>
  export const Separator: React.ForwardRefExoticComponent<{
    className?: string
    [key: string]: any
  }>
  export const Portal: React.ForwardRefExoticComponent<{
    children?: React.ReactNode
    container?: any
    [key: string]: any
  }>
  export const Icon: React.ForwardRefExoticComponent<{
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }>
  
  // Backwards compatibility exports
  export const Select: typeof Root
  export const SelectGroup: typeof Group
  export const SelectValue: typeof Value
  export const SelectTrigger: typeof Trigger
  export const SelectContent: typeof Content
  export const SelectItem: typeof Item
  export const SelectSeparator: typeof Separator
  export const SelectLabel: typeof Label
  export const SelectScrollUpButton: typeof ScrollUpButton
  export const SelectScrollDownButton: typeof ScrollDownButton
}

declare module '@radix-ui/react-accordion' {
  export const Accordion: any
  export const AccordionItem: any
  export const AccordionTrigger: any
  export const AccordionContent: any
  export default { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
}

declare module '@radix-ui/react-alert-dialog' {
  export const AlertDialog: any
  export const AlertDialogTrigger: any
  export const AlertDialogContent: any
  export default { AlertDialog, AlertDialogTrigger, AlertDialogContent }
}

declare module '@radix-ui/react-avatar' {
  export const Avatar: any
  export const AvatarImage: any
  export const AvatarFallback: any
  export default { Avatar, AvatarImage, AvatarFallback }
}

declare module '@radix-ui/react-checkbox' {
  export const Checkbox: any
  export default Checkbox
}

declare module '@radix-ui/react-dropdown-menu' {
  export const DropdownMenu: any
  export const DropdownMenuTrigger: any
  export const DropdownMenuContent: any
  export default { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent }
}

declare module '@radix-ui/react-navigation-menu' {
  export const NavigationMenu: any
  export const NavigationMenuTrigger: any
  export const NavigationMenuContent: any
  export default { NavigationMenu, NavigationMenuTrigger, NavigationMenuContent }
}

declare module '@radix-ui/react-scroll-area' {
  export const ScrollArea: any
  export default ScrollArea
}

declare module '@radix-ui/react-switch' {
  export const Switch: any
  export default Switch
}

declare module '@radix-ui/react-separator' {
  export const Root: React.ForwardRefExoticComponent<{
    className?: string
    orientation?: 'horizontal' | 'vertical'
    decorative?: boolean
    [key: string]: any
  }>
  export const Separator: typeof Root
}

declare module '@radix-ui/react-tooltip' {
  export const Tooltip: any
  export const TooltipTrigger: any
  export const TooltipContent: any
  export default { Tooltip, TooltipTrigger, TooltipContent }
}

declare module '@hookform/resolvers/zod' {
  export const zodResolver: any
  export default zodResolver
}

declare module 'framer-motion' {
  export const motion: any
  export const AnimatePresence: any
  export default { motion, AnimatePresence }
}

declare module 'next-themes' {
  export const ThemeProvider: any
  export const useTheme: any
  export default { ThemeProvider, useTheme }
}

declare module 'exceljs' {
  export const ExcelJS: any
  export default ExcelJS
}

declare module 'jsonwebtoken' {
  export const sign: any
  export const verify: any
  export default { sign, verify }
}

declare module 'uuid' {
  export const v4: any
  export default v4
}

declare module '@auth/prisma-adapter' {
  export const PrismaAdapter: any
  export default PrismaAdapter
}

declare module 'axios' {
  export const axios: any
  export default axios
}

declare module 'ioredis' {
  export const Redis: any
  export default Redis
}

declare module 'redis' {
  export const Redis: any
  export default Redis
}

declare module 'puppeteer' {
  export const puppeteer: any
  export default puppeteer
}

declare module 'puppeteer-extra' {
  export const puppeteerExtra: any
  export default puppeteerExtra
}

declare module 'puppeteer-extra-plugin-stealth' {
  export const stealthPlugin: any
  export default stealthPlugin
}

declare module 'googleapis' {
  export const google: any
  export default google
}

declare module 'google-auth-library' {
  export const GoogleAuth: any
  export default GoogleAuth
}

declare module 'google-ads-api' {
  export const GoogleAdsApi: any
  export default GoogleAdsApi
}

declare module 'nodemailer' {
  export const nodemailer: any
  export default nodemailer
}

declare module 'croner' {
  export const Cron: any
  export default Cron
}

declare module 'glob' {
  export const glob: any
  export default glob
}

declare module 'https-proxy-agent' {
  export const HttpsProxyAgent: any
  export default HttpsProxyAgent
}

declare module 'socks-proxy-agent' {
  export const SocksProxyAgent: any
  export default SocksProxyAgent
}

declare module 'cmdk' {
  export const Command: any
  export default Command
}

declare module 'zustand' {
  export const create: any
  export const persist: any
  export const immer: any
  export default { create, persist, immer }
}

declare module 'dompurify' {
  export const DOMPurify: any
  export default DOMPurify
}

declare module '@storybook/react' {
  export const storiesOf: any
  export default storiesOf
}

declare module '@storybook/testing-library' {
  export const userEvent: any
  export default userEvent
}

declare module '@storybook/jest' {
  export const matchers: any
  export default matchers
}

declare module '@storybook/nextjs-vite' {
  export const configure: any
  export const Meta: any
  export const StoryObj: any
  export default configure
}

declare module '@storybook/testing-library' {
  export const within: any
  export const userEvent: any
  export default { within, userEvent }
}

declare module '@storybook/jest' {
  export const expect: any
  export const matchers: any
  export default { expect, matchers }
}

declare module 'react-admin' {
  export const Button: React.ComponentType<{
    children?: React.ReactNode
    [key: string]: any
  }>
  export const Admin: any
  export const Resource: any
  export const CustomRoutes: any
  export const Edit: any
  export const SimpleForm: any
  export const TextInput: any
  export const SelectInput: any
  export const BooleanInput: any
  export const NumberInput: any
  export const FormDataConsumer: any
  export const useEditContext: any
  export const useNotify: any
  export const useRefresh: any
  export const SaveButton: any
  export const Toolbar: any
  export const Layout: any
  export const AppBar: any
  export const UserMenu: any
  export const MenuItemLink: any
  export const Sidebar: any
  export const Menu: any
  export const useTheme: any
  export const useDataProvider: any
  export const useRecordContext: any
  export const useUnselectAll: (resource: string) => () => void
  export const List: any
  export const Datagrid: any
  export const TextField: any
  export const EmailField: any
  export const DateField: any
  export const BooleanField: any
  export const NumberField: any
  export const EditButton: any
  export const DeleteButton: any
  export const ShowButton: any
  export const FilterButton: any
  export const CreateButton: any
  export const ExportButton: any
  export const BulkDeleteButton: any
  export const BulkExportButton: any
  export const TopToolbar: any
  export const SearchInput: any
  export const Confirm: any
  export const useCreate: any
  export const useUpdate: any
  export const useDelete: any
  export const useGetList: any
  export const useGetOne: any
  export const useTranslate: any
  export const usePermissions: any
  export const fetchUtils: {
    fetchJson: (url: string, options?: any) => Promise<any>
    queryParameters: (params: any) => string
  }
  
  // Type definitions
  export type GetListParams = any
  export type GetListResult = any
  export type GetOneParams = any
  export type GetOneResult = any
  export type GetManyParams = any
  export type GetManyResult = any
  export type GetManyReferenceParams = any
  export type GetManyReferenceResult = any
  export type CreateParams = any
  export type CreateResult = any
  export type UpdateParams = any
  export type UpdateResult = any
  export type UpdateManyParams = any
  export type UpdateManyResult = any
  export type DeleteParams = any
  export type DeleteResult = any
  export type DeleteManyParams = any
  export type DeleteManyResult = any
  
  // Auth provider
  export type AuthProvider = any
  
  // Data provider interface
  export type DataProvider = {
    getList: (resource: string, params: GetListParams) => Promise<GetListResult>
    getOne: (resource: string, params: GetOneParams) => Promise<GetOneResult>
    getMany: (resource: string, params: GetManyParams) => Promise<GetManyResult>
    getManyReference: (resource: string, params: GetManyReferenceParams) => Promise<GetManyReferenceResult>
    create: (resource: string, params: CreateParams) => Promise<CreateResult>
    update: (resource: string, params: UpdateParams) => Promise<UpdateResult>
    updateMany: (resource: string, params: UpdateManyParams) => Promise<UpdateManyResult>
    delete: (resource: string, params: DeleteParams) => Promise<DeleteResult>
    deleteMany: (resource: string, params: DeleteManyParams) => Promise<DeleteManyResult>
  }
}

declare module 'swagger-ui-react' {
  export const SwaggerUI: any
  export default SwaggerUI
}

// Fix ReactNode type compatibility and component types
declare module '@types/react' {
  namespace React {
    type ReactNode = React.ReactNode | bigint
    
    // More permissive ForwardRefExoticComponent
    interface ForwardRefExoticComponent<P> extends ComponentType<P> {
      displayName?: string
      defaultProps?: Partial<P>
      propTypes?: any
    }
    
    // More permissive FunctionComponent
    interface FunctionComponent<P = {}> {
      (props: P & { children?: React.ReactNode }, context?: any): ReactElement | null
      displayName?: string
      defaultProps?: Partial<P>
      propTypes?: any
      contextTypes?: any
    }
  }
  
  // Extend Element type
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    children?: React.ReactNode
  }
}