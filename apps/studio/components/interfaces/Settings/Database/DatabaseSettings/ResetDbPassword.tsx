import { PermissionAction } from '@supabase/shared-types/out/constants'
import { useParams } from 'common'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogSectionSeparator,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
} from 'ui'
import { Input } from 'ui-patterns/DataInputs/Input'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import {
  PageSection,
  PageSectionContent,
  PageSectionDescription,
  PageSectionMeta,
  PageSectionSummary,
  PageSectionTitle,
} from 'ui-patterns/PageSection'

import { ButtonTooltip } from '@/components/ui/ButtonTooltip'
import { PasswordStrengthBar } from '@/components/ui/PasswordStrengthBar'
import { useDatabasePasswordResetMutation } from '@/data/database/database-password-reset-mutation'
import { useAsyncCheckPermissions } from '@/hooks/misc/useCheckPermissions'
import { useIsProjectActive, useSelectedProjectQuery } from '@/hooks/misc/useSelectedProject'
import { DEFAULT_MINIMUM_PASSWORD_STRENGTH } from '@/lib/constants'
import { passwordStrength, PasswordStrengthScore } from '@/lib/password-strength'
import { generateStrongPassword } from '@/lib/project'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const formSchema = z.object({
  password: z.string().min(6, 'Your password must contain at least 6 character'),
})

type FormSchema = z.infer<typeof formSchema>

export const ResetDbPassword = ({ disabled = false }) => {
  const { ref } = useParams()
  const isProjectActive = useIsProjectActive()
  const { data: project } = useSelectedProjectQuery()

  const form = useForm<FormSchema>({
      resolver: zodResolver(formSchema),
    })

  const formId = 'schema-form'

  const { can: canResetDbPassword } = useAsyncCheckPermissions(
    PermissionAction.UPDATE,
    'projects',
    {
      resource: {
        project_id: project?.id,
      },
    }
  )

  const [showResetDbPass, setShowResetDbPass] = useState<boolean>(false)

  const password = useWatch({
    control: form.control,
    name: 'password',
  }) ?? ''
  
  const [passwordStrengthMessage, setPasswordStrengthMessage] = useState<string>('')
  const [passwordStrengthWarning, setPasswordStrengthWarning] = useState<string>('')
  const [passwordStrengthScore, setPasswordStrengthScore] = useState(0)

  const { mutate: resetDatabasePassword, isPending: isUpdatingPassword } =
    useDatabasePasswordResetMutation({
      onSuccess: async () => {
        toast.success('Successfully updated database password')
        setShowResetDbPass(false)
      },
    })

  useEffect(() => {
    if (showResetDbPass) {
      form.reset({
        password: '',
      })
      setPasswordStrengthMessage('')
      setPasswordStrengthWarning('')
      setPasswordStrengthScore(0)
    }
  }, [showResetDbPass, form])

  async function checkPasswordStrength(value: string) {
    const { message, warning, strength } = await passwordStrength(value)
    setPasswordStrengthScore(strength)
    setPasswordStrengthWarning(warning)
    setPasswordStrengthMessage(message)
  }

  useEffect(() => {
    if (!password) {
      setPasswordStrengthScore(-1)
      setPasswordStrengthMessage('')
      setPasswordStrengthWarning('')
      return
    }

    checkPasswordStrength(password)
  }, [password])

  function generatePassword() {
    const password = generateStrongPassword()
    form.setValue('password', password, {
      shouldValidate: true,
    })
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
      if (!ref) return console.error('Project is required')

      if (passwordStrengthScore < DEFAULT_MINIMUM_PASSWORD_STRENGTH) {
        return
      }
  
      resetDatabasePassword({
        ref,
        password: values.password,
      })
    }

  return (
    <PageSection id="database-password">
      <PageSectionMeta>
        <PageSectionSummary>
          <PageSectionTitle>Database password</PageSectionTitle>

            <PageSectionDescription>Used for direct Postgres connections</PageSectionDescription>
          </PageSectionSummary>
        </PageSectionMeta>
        <PageSectionContent>
          <Card>
            <CardContent className="flex flex-row items-center gap-x-2 justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm text-foreground">Reset database password</h3>
                <p className="text-sm text-foreground-light text-balance">
                  The database password isn’t viewable after creation. Resetting it will break any
                  existing connections.
                </p>
              </div>
              <Dialog open={showResetDbPass} onOpenChange={(open) => setShowResetDbPass(open)}>
                <DialogTrigger asChild>
                  <ButtonTooltip
                    type="default"
                    disabled={!canResetDbPassword || !isProjectActive || disabled}
                    tooltip={{
                      content: {
                        side: 'bottom',
                        text: !canResetDbPassword
                          ? 'You need additional permissions to reset the database password'
                          : !isProjectActive
                            ? 'Unable to reset database password as project is not active'
                            : undefined,
                      },
                    }}
                  >
                    Reset password
                  </ButtonTooltip>
                </DialogTrigger>
                <DialogContent size="medium">
                  <DialogHeader>
                    <DialogTitle>Reset database password</DialogTitle>
                  </DialogHeader>
                  <DialogSectionSeparator />
                  <DialogSection className="w-full space-y-8">
                    <Form {...form}>
                      <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItemLayout
                              layout="vertical"
                              description={
                                <PasswordStrengthBar
                                  passwordStrengthScore={passwordStrengthScore as PasswordStrengthScore}
                                  passwordStrengthMessage={passwordStrengthMessage}
                                  password={password}
                                  generateStrongPassword={generatePassword}
                                />
                              }
                              error={passwordStrengthWarning}
                            >
                              <FormControl>
                                <Input
                                   {...field}
                                  copy={password.length > 0}
                                  aria-invalid={!!passwordStrengthWarning}
                                  type="password"
                                  placeholder="Type in a strong password"
                                  autoComplete="off"
                                />
                              </FormControl>
                            </FormItemLayout>
                          )}
                        />
                      </form>
                    </Form>
                  </DialogSection>
                  <DialogFooter>
                    <Button
                      type="default"
                      disabled={isUpdatingPassword}
                      onClick={() => setShowResetDbPass(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      form={formId}
                      htmlType="submit"
                      loading={isUpdatingPassword}
                      disabled={isUpdatingPassword}
                    >
                      Reset password
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </PageSectionContent>
      </PageSection>
  )
}