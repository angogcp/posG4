import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

void main() {
  runApp(const PosG4App());
}

class PosG4App extends StatelessWidget {
  const PosG4App({super.key});

  static const String defaultFrontendUrl = 'http://192.168.0.122:5791';

  @override
  Widget build(BuildContext context) {
    // Branded system UI
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Color(0xFF4F46E5),
      statusBarIconBrightness: Brightness.light,
    ));

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'POS G4',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
        useMaterial3: true,
      ),
      home: const _WebViewScreen(),
    );
  }
}

class _WebViewScreen extends StatefulWidget {
  const _WebViewScreen();

  @override
  State<_WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<_WebViewScreen> {
  late final WebViewController _controller;
  bool _canGoBack = false;
  bool _canGoForward = false;
  bool _loading = true;
  bool _offline = false;
  String? _errorMessage;
  String _currentUrl = PosG4App.defaultFrontendUrl;
  late final Connectivity _connectivity;
  late final Stream<List<ConnectivityResult>> _connectivityStream;
  bool _showAppBar = false;
  bool _wakelockEnabled = true;

  @override
  void initState() {
    super.initState();
    _connectivity = Connectivity();
    _connectivityStream = _connectivity.onConnectivityChanged;
    _loadSavedUrl();
    WakelockPlus.enable();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) async {
            final canBack = await _controller.canGoBack();
            final canForward = await _controller.canGoForward();
            setState(() {
              _canGoBack = canBack;
              _canGoForward = canForward;
              _loading = false;
              _errorMessage = null;
            });
          },
          onWebResourceError: (err) {
            setState(() {
              _errorMessage = err.description;
              _loading = false;
            });
          },
        ),
      )
      ..loadRequest(Uri.parse(_currentUrl));

    _connectivity.checkConnectivity().then(_updateConnectivity);
    _connectivityStream.listen(_updateConnectivity);
  }

  Future<void> _loadSavedUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('frontendUrl');
    if (saved != null && saved.isNotEmpty) {
      setState(() => _currentUrl = saved);
    }
  }

  Future<void> _saveUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('frontendUrl', url);
  }

  void _updateConnectivity(List<ConnectivityResult> results) {
    final offline = results.contains(ConnectivityResult.none);
    setState(() => _offline = offline);
  }

  Future<void> _goBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
    }
  }

  Future<void> _goForward() async {
    if (await _controller.canGoForward()) {
      await _controller.goForward();
    }
  }

  Future<void> _openExternal() async {
    final uri = Uri.parse(_currentUrl);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _changeUrlDialog() async {
    final controller = TextEditingController(text: _currentUrl);
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Set Frontend URL'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'URL',
              hintText: 'http://192.168.0.122:5791 or http://<pc-ip>:5791',
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Save')),
          ],
        );
      },
    );
    if (url != null && url.isNotEmpty) {
      setState(() => _currentUrl = url);
      await _saveUrl(url);
      await _controller.loadRequest(Uri.parse(url));
    }
  }

  Future<void> _clearCookies() async {
    final manager = WebViewCookieManager();
    await manager.clearCookies();
    await _controller.reload();
  }

  Future<void> _goHome() async {
    setState(() => _currentUrl = PosG4App.defaultFrontendUrl);
    await _saveUrl(_currentUrl);
    await _controller.loadRequest(Uri.parse(_currentUrl));
  }

  void _toggleAppBar() {
    setState(() => _showAppBar = !_showAppBar);
  }

  Future<void> _toggleWakelock() async {
    if (_wakelockEnabled) {
      await WakelockPlus.disable();
    } else {
      await WakelockPlus.enable();
    }
    setState(() => _wakelockEnabled = !_wakelockEnabled);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _showAppBar ? AppBar(
        title: const Text('POS G4'),
        leading: _canGoBack
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _goBack,
                tooltip: 'Back',
              )
            : null,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _controller.reload(),
            tooltip: 'Reload',
          ),
          PopupMenuButton<String>(
            onSelected: (v) async {
              switch (v) {
                case 'open':
                  await _openExternal();
                  break;
                case 'url':
                  await _changeUrlDialog();
                  break;
                case 'cookies':
                  await _clearCookies();
                  break;
                case 'appbar':
                  _toggleAppBar();
                  break;
                case 'wakelock':
                  await _toggleWakelock();
                  break;
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'open', child: Text('Open in browser')),
              const PopupMenuItem(value: 'url', child: Text('Change frontend URL')),
              const PopupMenuItem(value: 'cookies', child: Text('Clear cookies')),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'appbar',
                child: Text(_showAppBar ? 'Hide top toolbar' : 'Show top toolbar'),
              ),
              PopupMenuItem(
                value: 'wakelock',
                child: Text(_wakelockEnabled ? 'Disable keep-awake' : 'Enable keep-awake'),
              ),
            ],
          ),
        ],
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4F46E5), Color(0xFF6366F1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ) : null,
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_offline)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                color: Colors.amber.shade700,
                child: Row(
                  children: const [
                    Icon(Icons.wifi_off, color: Colors.white),
                    SizedBox(width: 8),
                    Expanded(child: Text('Offline: check network', style: TextStyle(color: Colors.white))),
                  ],
                ),
              ),
            ),
          if (_loading)
            const Center(child: CircularProgressIndicator()),
          if (_errorMessage != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                    const SizedBox(height: 16),
                    Text('Failed to load', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text(_errorMessage!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => _controller.loadRequest(Uri.parse(_currentUrl)),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: BottomAppBar(
        color: const Color(0xFF1F2937),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.home, color: Colors.white),
                tooltip: 'Home',
                onPressed: _goHome,
              ),
              IconButton(
                icon: Icon(Icons.arrow_back, color: _canGoBack ? Colors.white : Colors.white54),
                tooltip: 'Back',
                onPressed: _canGoBack ? _goBack : null,
              ),
              IconButton(
                icon: Icon(Icons.arrow_forward, color: _canGoForward ? Colors.white : Colors.white54),
                tooltip: 'Forward',
                onPressed: _canGoForward ? _goForward : null,
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white),
                tooltip: 'Reload',
                onPressed: () => _controller.reload(),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, color: Colors.white),
                onSelected: (v) async {
                  switch (v) {
                    case 'open':
                      await _openExternal();
                      break;
                    case 'url':
                      await _changeUrlDialog();
                      break;
                    case 'cookies':
                      await _clearCookies();
                      break;
                    case 'appbar':
                      _toggleAppBar();
                      break;
                    case 'wakelock':
                      await _toggleWakelock();
                      break;
                  }
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'open', child: Text('Open in browser')),
                  const PopupMenuItem(value: 'url', child: Text('Change frontend URL')),
                  const PopupMenuItem(value: 'cookies', child: Text('Clear cookies')),
                  const PopupMenuDivider(),
                  PopupMenuItem(
                    value: 'appbar',
                    child: Text(_showAppBar ? 'Hide top toolbar' : 'Show top toolbar'),
                  ),
                  PopupMenuItem(
                    value: 'wakelock',
                    child: Text(_wakelockEnabled ? 'Disable keep-awake' : 'Enable keep-awake'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
