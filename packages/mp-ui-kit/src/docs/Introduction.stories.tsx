import {Box, Divider, Stack, Typography} from '@mui/material';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {ReactNode} from 'react';
import {mpTokens as t} from '../theme/tokens';

const meta = {
  title: 'Introduction',
  parameters: {layout: 'padded'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Code({children}: { children: string }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        borderRadius: 2,
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
        border: '1px solid',
        borderColor: 'divider',
        overflowX: 'auto',
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      }}
    >
      {children}
    </Box>
  );
}

function Section({title, children}: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="h5" sx={{mb: 1.5}}>
        {title}
      </Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  );
}

export const Overview: Story = {
  render: () => (
    <Stack spacing={4} sx={{maxWidth: 860}}>
      <Box>
        <Typography sx={{...t.typography.scale.display}}>mp-ui-kit</Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{mt: 1}}>
          Дизайн-система и библиотека компонентов на базе Material UI: токены, тема и
          переиспользуемые React-компоненты с опциями доступности из коробки.
        </Typography>
      </Box>

      <Divider/>

      <Section title="Установка">
        <Code>{`npm install mp-ui-kit @mui/material @emotion/react @emotion/styled react react-dom`}</Code>
        <Typography variant="body2" color="text.secondary">
          MUI, Emotion и React — peer-зависимости: они остаются в проекте потребителя,
          поэтому версии согласуются с вашим приложением.
        </Typography>
      </Section>

      <Section title="Быстрый старт">
        <Code>{`import { MpThemeProvider, MpButton, MpTextField } from 'mp-ui-kit';

export function App() {
  return (
    <MpThemeProvider mode="light">
      <MpTextField label="Электронная почта" placeholder="user@example.com" />
      <MpButton variant="contained" loading>
        Сохранить
      </MpButton>
    </MpThemeProvider>
  );
}`}</Code>
      </Section>

      <Section title="Тёмная тема">
        <Code>{`// Режим задаётся один раз в корне приложения
<MpThemeProvider mode="dark">...</MpThemeProvider>`}</Code>
        <Typography variant="body2" color="text.secondary">
          Все компоненты читают палитру из темы, поэтому переключение режима ничего больше
          не требует. В Storybook режим переключается в верхней панели («Тема»).
        </Typography>
      </Section>

      <Section title="Состав">
        <Typography variant="body2">
          • <b>Токены</b> — цвета, типографика, отступы, радиусы, тени, движение (src/theme/tokens.ts)
          <br/>
          • <b>Тема</b> — createMpTheme / MpThemeProvider, сборка токенов в тему MUI
          <br/>
          • <b>Компоненты</b> — Button, TextField, Alert, Chip, Badge, Avatar, Card
          <br/>
          • <b>Документация</b> — Storybook: Foundations + страницы каждого компонента
        </Typography>
      </Section>
    </Stack>
  ),
};
