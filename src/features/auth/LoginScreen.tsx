import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Appbar, Button, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from './AuthContext';
import { BRAND, CANVAS, DENSITY, RADIUS } from '@/theme/tokens';

export function LoginScreen() {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  const { login } = useAuth();
  const [email, setEmail] = useState('oncall@demo.io');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: canvas.page }]}>
      <Appbar.Header mode="small" elevated={false} style={{ backgroundColor: canvas.surface }}>
        <View style={[styles.brandMark, { backgroundColor: BRAND.lime }]} />
        <Appbar.Content
          title="Incident Triage"
          titleStyle={[styles.appbarTitle, { color: canvas.text, fontFamily: theme.fonts.titleLarge.fontFamily }]}
        />
      </Appbar.Header>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <View style={[styles.panel, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
          <Text
            variant="headlineSmall"
            style={[styles.title, { color: canvas.text, fontFamily: theme.fonts.headlineSmall.fontFamily }]}
          >
            On-call sign in
          </Text>
          <Text variant="bodySmall" style={[styles.copy, { color: canvas.textDim }]}>
            Use the demo account to review grouped incidents from the mock corpus.
          </Text>
          <TextInput
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            dense
          />
          <TextInput
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            dense
            style={styles.input}
          />
          <Button mode="contained" onPress={submit} loading={loading} disabled={loading} compact style={styles.button}>
            Sign in
          </Button>
        </View>
      </KeyboardAvoidingView>
      <Snackbar visible={!!error} onDismiss={() => setError('')} duration={3500}>
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', padding: 16 },
  panel: { borderWidth: 1, borderRadius: RADIUS.panel, padding: 16, gap: 10 },
  brandMark: { borderRadius: 2, height: 9, marginLeft: 16, width: 9 },
  appbarTitle: { fontSize: 20, fontWeight: '400' },
  title: { fontSize: 27, fontWeight: '400', lineHeight: 31 },
  copy: { marginBottom: 4, fontSize: DENSITY.fontSize },
  input: { marginTop: 2 },
  button: { borderRadius: RADIUS.control, marginTop: 6 }
});
