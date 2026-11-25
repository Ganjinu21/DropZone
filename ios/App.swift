import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let gameWindow = UIWindow(windowScene: windowScene)
        gameWindow.rootViewController = GameController()
        self.window = gameWindow
        gameWindow.makeKeyAndVisible()
    }
}

final class GameController: UIViewController {
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.preferences.isTextInteractionEnabled = false
        let game = WKWebView(frame: .zero, configuration: config)
        game.isOpaque = false
        game.backgroundColor = UIColor(red: 0.07, green: 0.11, blue: 0.14, alpha: 1)
        game.scrollView.contentInsetAdjustmentBehavior = .never
        game.scrollView.bounces = false
        view = game
        guard let entry = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "game") else {
            preconditionFailure("Missing bundled game")
        }
        game.loadFileURL(entry, allowingReadAccessTo: entry.deletingLastPathComponent())
    }
}
