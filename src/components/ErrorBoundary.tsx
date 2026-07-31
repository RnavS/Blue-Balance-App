import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes anywhere below it.
 *
 * Without this, one thrown component unmounts the whole tree: in a release build
 * that is a blank screen with no message and no way out except force-quitting,
 * which reads as "the app is broken". Here the user gets an explanation and a
 * button that puts them back.
 *
 * React only routes render/lifecycle errors to a boundary. Rejected promises in
 * event handlers still need their own try/catch.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught a render error:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Blue Balance hit an unexpected error. Your logged data is safe — it lives on the
          server, not in this screen.
        </Text>

        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>

        {__DEV__ ? (
          <ScrollView style={styles.details}>
            <Text style={styles.detailsText}>
              {error.message}
              {'\n\n'}
              {error.stack}
            </Text>
          </ScrollView>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f0f1a',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  body: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  details: { marginTop: 28, maxHeight: 220, alignSelf: 'stretch' },
  detailsText: { color: '#6b7280', fontSize: 11, fontFamily: 'monospace' },
});
