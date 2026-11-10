import {Box, Stack, Typography, useTheme} from '@mui/material';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {mpTokens as t} from '../theme/tokens';

const meta = {
  title: 'Foundations',
  parameters: {layout: 'padded'},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({name, value}: { name: string; value: string }) {
  return (
    <Box sx={{textAlign: 'center', minWidth: 80}}>
      <Box
        sx={{
          width: 64,
          height: 44,
          mx: 'auto',
          borderRadius: 1.5,
          bgcolor: value,
          border: '1px solid',
          borderColor: 'divider',
        }}
      />
      <Typography variant="caption" sx={{display: 'block', mt: 0.75}}>
        {name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{display: 'block', fontFamily: 'monospace'}}>
        {value}
      </Typography>
    </Box>
  );
}

function ColorScale({title, scale}: { title: string; scale: Record<string, string> }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{mb: 1}}>
        {title}
      </Typography>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{flexWrap: 'wrap'}}>
        {Object.entries(scale).map(([step, value]) => (
          <Swatch key={step} name={step} value={value}/>
        ))}
      </Stack>
    </Box>
  );
}

export const Colors: Story = {
  render: () => (
    <Stack spacing={3} sx={{maxWidth: 980}}>
      <Typography variant="h4">Цвета</Typography>
      <ColorScale title="brand (indigo)" scale={{...t.brand}}/>
      <ColorScale title="neutral (slate)" scale={{...t.neutral}}/>
      <Box>
        <Typography variant="subtitle2" sx={{mb: 1}}>
          semantic
        </Typography>
        <Stack direction="row" spacing={3} useFlexGap sx={{flexWrap: 'wrap'}}>
          {Object.entries(t.semantic).map(([name, color]) => (
            <Stack key={name} direction="row" spacing={1}>
              <Swatch name={`${name}.main`} value={color.main}/>
              <Swatch name={`${name}.light`} value={color.light}/>
              <Swatch name={`${name}.dark`} value={color.dark}/>
            </Stack>
          ))}
        </Stack>
      </Box>
      <Typography variant="body2" color="text.secondary">
        Собственные цвета доступны в палитре темы как <code>brand</code> и <code>neutral</code> —
        включая пропсы компонентов: <code>&lt;MpButton color=&quot;neutral&quot;&gt;</code>,{' '}
        <code>&lt;MpChip color=&quot;brand&quot;&gt;</code>.
      </Typography>
    </Stack>
  ),
};

type VariantName =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle1'
  | 'subtitle2'
  | 'body1'
  | 'body2'
  | 'caption'
  | 'overline';

function TypographyDoc() {
  const theme = useTheme();
  const rows: Array<[string, VariantName]> = [
    ['h1', 'h1'],
    ['h2', 'h2'],
    ['h3', 'h3'],
    ['h4', 'h4'],
    ['h5', 'h5'],
    ['h6', 'h6'],
    ['subtitle1', 'subtitle1'],
    ['subtitle2', 'subtitle2'],
    ['body1', 'body1'],
    ['body2', 'body2'],
    ['caption', 'caption'],
    ['overline', 'overline'],
  ];

  return (
    <Stack spacing={2} sx={{maxWidth: 980}}>
      <Typography variant="h4">Типографика</Typography>
      <Typography variant="body2" color="text.secondary">
        Шрифт: {theme.typography.fontFamily}
      </Typography>

      <Stack direction="row" spacing={2} sx={{alignItems: 'baseline'}}>
        <Box sx={{width: 110, flexShrink: 0}}>
          <Typography variant="caption" color="text.secondary">
            display
          </Typography>
        </Box>
        <Typography sx={{...t.typography.scale.display}}>Съешь ещё этих мягких булок</Typography>
      </Stack>

      {rows.map(([label, variant]) => (
        <Stack key={label} direction="row" spacing={2} sx={{alignItems: 'baseline'}}>
          <Box sx={{width: 110, flexShrink: 0}}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
          <Typography variant={variant} noWrap sx={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
            Съешь ещё этих мягких булок
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export const TypographyScale: Story = {
  render: () => <TypographyDoc/>,
};

function RadiusAndSpacingDoc() {
  return (
    <Stack spacing={3} sx={{maxWidth: 980}}>
      <Typography variant="h4">Скругления</Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{flexWrap: 'wrap'}}>
        {Object.entries(t.radius).map(([name, value]) => (
          <Box key={name} sx={{textAlign: 'center'}}>
            <Box
              sx={{
                width: 72,
                height: 56,
                bgcolor: t.brand[600],
                borderRadius: value,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
            <Typography variant="caption" sx={{display: 'block', mt: 0.75}}>
              {name} = {value}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Typography variant="h4" sx={{mt: 2}}>
        Отступы
      </Typography>
      <Stack spacing={1}>
        {Object.entries(t.spacing).map(([name, value]) => (
          <Stack key={name} direction="row" spacing={2} sx={{alignItems: 'center'}}>
            <Typography variant="caption" sx={{width: 48, fontFamily: 'monospace'}}>
              {name}
            </Typography>
            <Box sx={{width: value * 4, height: 12, bgcolor: t.brand[600], borderRadius: 0.75}}/>
            <Typography variant="caption" color="text.secondary">
              {value}px
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export const RadiusAndSpacing: Story = {
  render: () => <RadiusAndSpacingDoc/>,
};

function ShadowsDoc() {
  const theme = useTheme();
  const levels: Array<[string, number]> = [
    ['sm', 1],
    ['md', 3],
    ['lg', 6],
    ['xl', 12],
  ];

  return (
    <Stack spacing={3} sx={{maxWidth: 980}}>
      <Typography variant="h4">Тени</Typography>
      <Stack direction="row" spacing={3} useFlexGap sx={{flexWrap: 'wrap'}}>
        {levels.map(([name, level]) => (
          <Box key={name} sx={{textAlign: 'center'}}>
            <Box
              sx={{
                width: 140,
                height: 96,
                borderRadius: 3,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: theme.shadows[level],
              }}
            />
            <Typography variant="caption" sx={{display: 'block', mt: 1}}>
              {name} — shadows[{level}]
            </Typography>
          </Box>
        ))}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Тени адаптируются к цветовой схеме: в тёмной теме уровни темнее и мягче (токены
        shadow.light / shadow.dark).
      </Typography>
    </Stack>
  );
}

export const Shadows: Story = {
  render: () => <ShadowsDoc/>,
};
