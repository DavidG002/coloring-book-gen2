<?php
/**
 * Plugin Name: ZuzuPlug
 * Description: Yoast SEO field support and Polylang free-tier language linking for posts and taxonomy terms — no Polylang Pro required.
 * Version: 1.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: David
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Piece 1: Make Yoast's SEO fields writable via the REST API.
 */
add_action('init', function () {
    if (!function_exists('register_post_meta')) {
        return;
    }
    $keys = ['_yoast_wpseo_title', '_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw'];
    foreach ($keys as $key) {
        register_post_meta('post', $key, [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'auth_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});

/**
 * Piece 2: Custom REST endpoints for setting a post's or term's language
 * and linking translations, using Polylang's free-tier functions
 * directly — since the native REST fields for this are Polylang
 * Pro-only.
 */
add_action('rest_api_init', function () {
    register_rest_route('zuzuplug/v1', '/set-post-language', [
        'methods' => 'POST',
        'callback' => 'zuzuplug_set_post_language',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);

    register_rest_route('zuzuplug/v1', '/set-term-language', [
        'methods' => 'POST',
        'callback' => 'zuzuplug_set_term_language',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

/**
 * Forces Yoast to rebuild a specific indexable (post or term) right now,
 * using the same internal builder class Yoast's own WP-CLI reindex
 * command uses. Uses the ->classes-> access surface, which Yoast has
 * flagged for eventual deprecation — no equally precise, sanctioned
 * alternative exists as of this writing (Yoast SEO 28.x). If this stops
 * working after a future Yoast update, the "Reindex everything now"
 * button on this plugin's settings page is the fallback.
 */
function zuzuplug_rebuild_indexable($object_id, $object_type) {
    if (!function_exists('YoastSEO')) {
        return 'YoastSEO() function not found';
    }
    try {
        $repository = YoastSEO()->classes->get('Yoast\WP\SEO\Repositories\Indexable_Repository');
        $indexable = $repository->find_by_id_and_type($object_id, $object_type);

        if ($indexable) {
            // The hierarchy builder skips rebuilding ancestor/breadcrumb
            // chains if it thinks they're already built — even if they
            // were built with stale data. Explicitly clear them first so
            // the rebuild below is forced to regenerate the real chain.
            $hierarchy_repository = YoastSEO()->classes->get('Yoast\WP\SEO\Repositories\Indexable_Hierarchy_Repository');
            $hierarchy_repository->clear_ancestors($indexable->id);
        }

        $builder = YoastSEO()->classes->get('Yoast\WP\SEO\Builders\Indexable_Builder');
        $indexable = $builder->build_for_id_and_type($object_id, $object_type);
        if ($indexable) {
            $indexable->save();
            return true;
        }
        return 'build_for_id_and_type returned nothing';
    } catch (\Throwable $e) {
        return 'Exception: ' . $e->getMessage();
    }
}

add_action('rest_api_init', function () {
    register_rest_route('zuzuplug/v1', '/debug-reindex', [
        'methods' => 'POST',
        'callback' => function ($request) {
            $post_id = (int) $request->get_param('post_id');
            $result = zuzuplug_rebuild_indexable($post_id, 'post');
            return ['result' => $result];
        },
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        },
    ]);
});

function zuzuplug_set_post_language($request) {
    if (!function_exists('pll_set_post_language')) {
        return new WP_Error('polylang_missing', 'Polylang is not active on this site.', ['status' => 400]);
    }

    $post_id = (int) $request->get_param('post_id');
    $lang = sanitize_text_field($request->get_param('lang'));
    $translations = $request->get_param('translations');

    pll_set_post_language($post_id, $lang);

    if (is_array($translations)) {
        $translations[$lang] = $post_id;
        pll_save_post_translations($translations);
    }

    // This post's indexable was originally built at creation time,
    // before its language was set here — rebuild now that it's complete.
    zuzuplug_rebuild_indexable($post_id, 'post');

    return ['success' => true, 'post_id' => $post_id, 'lang' => $lang];
}

function zuzuplug_set_term_language($request) {
    if (!function_exists('pll_set_term_language')) {
        return new WP_Error('polylang_missing', 'Polylang is not active on this site.', ['status' => 400]);
    }

    $term_id = (int) $request->get_param('term_id');
    $lang = sanitize_text_field($request->get_param('lang'));
    $translations = $request->get_param('translations');

    pll_set_term_language($term_id, $lang);

    if (is_array($translations)) {
        $translations[$lang] = $term_id;
        pll_save_term_translations($translations);
    }

    zuzuplug_rebuild_indexable($term_id, 'term');

    return ['success' => true, 'term_id' => $term_id, 'lang' => $lang];
}

/**
 * Piece 3: Admin settings page — status dashboard and a manual
 * "reindex everything" fallback, in case the automatic per-call
 * rebuild above ever stops working (e.g. a future Yoast update removes
 * the internal class it depends on).
 */
add_action('admin_menu', function () {
    add_options_page(
        'ZuzuPlug',
        'ZuzuPlug',
        'manage_options',
        'zuzuplug',
        'zuzuplug_render_settings_page'
    );
});

function zuzuplug_render_settings_page() {
    $polylang_active = function_exists('pll_set_post_language');
    $yoast_active = function_exists('YoastSEO');
    $reindexed = isset($_GET['reindexed']);
    ?>
    <div class="wrap">
        <h1>ZuzuPlug</h1>
        <p>Publishing bridge for Yoast SEO field support and free-tier Polylang language linking.</p>

        <?php if ($reindexed): ?>
            <div class="notice notice-success"><p>Reindex complete.</p></div>
        <?php endif; ?>

        <h2>Status</h2>
        <table class="widefat" style="max-width: 500px;">
            <tbody>
                <tr>
                    <td>Polylang</td>
                    <td><?php echo $polylang_active ? '✅ Active' : '❌ Not detected'; ?></td>
                </tr>
                <tr>
                    <td>Yoast SEO</td>
                    <td><?php echo $yoast_active ? '✅ Active' : '❌ Not detected'; ?></td>
                </tr>
                <tr>
                    <td>REST namespace</td>
                    <td><code>/wp-json/zuzuplug/v1/</code></td>
                </tr>
                <tr>
                    <td>Version</td>
                    <td>1.1.0</td>
                </tr>
            </tbody>
        </table>

        <h2 style="margin-top: 30px;">Reindex</h2>
        <p>
            Posts and terms created via the REST API automatically get their
            Yoast indexable data rebuilt right after their language is set.
            If breadcrumbs or SEO data still look stale for any content,
            use this as a manual fallback — it reindexes every post and
            term on the site, the same as Yoast's own <code>wp yoast index</code>
            command.
        </p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <?php wp_nonce_field('zuzuplug_reindex_all'); ?>
            <input type="hidden" name="action" value="zuzuplug_reindex_all">
            <button type="submit" class="button button-primary" <?php echo $yoast_active ? '' : 'disabled'; ?>>
                Reindex everything now
            </button>
        </form>
    </div>
    <?php
}

add_action('admin_post_zuzuplug_reindex_all', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Not allowed');
    }
    check_admin_referer('zuzuplug_reindex_all');

    if (function_exists('YoastSEO')) {
        $posts = get_posts(['post_type' => 'post', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids']);
        foreach ($posts as $post_id) {
            zuzuplug_rebuild_indexable($post_id, 'post');
        }

        $terms = get_terms(['taxonomy' => 'category', 'hide_empty' => false, 'fields' => 'ids']);
        if (!is_wp_error($terms)) {
            foreach ($terms as $term_id) {
                zuzuplug_rebuild_indexable($term_id, 'term');
            }
        }
    }

    wp_redirect(admin_url('options-general.php?page=zuzuplug&reindexed=1'));
    exit;
});

/**
 * Piece 4: A friendly admin notice if the plugins this depends on
 * aren't active.
 */
add_action('admin_notices', function () {
    $missing = [];
    if (!class_exists('WPSEO_Options')) {
        $missing[] = 'Yoast SEO';
    }
    if (!function_exists('pll_set_post_language')) {
        $missing[] = 'Polylang';
    }
    if (!empty($missing)) {
        $list = implode(' and ', $missing);
        echo '<div class="notice notice-warning"><p><strong>ZuzuPlug:</strong> ' . esc_html($list) . ' not detected — some features will not work until ' . (count($missing) > 1 ? 'they are' : 'it is') . ' installed and active.</p></div>';
    }
});
