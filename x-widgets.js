/*

	X-WIDGETS: Data-driven web components in JavaScript.
	Written by Cosmin Apreutesei. Public Domain.

*/

// ---------------------------------------------------------------------------
// rowset
// ---------------------------------------------------------------------------

/*
	rowset(...options) -> rs

	rs.can_edit        : can edit at all (true)
	rs.can_add_rows    : allow adding/inserting rows (false)
	rs.can_remove_rows : allow removing rows (false)
	rs.can_change_rows : allow editing cell values (false)

	rs.fields: [{attr->val}, ...]

	identification:
		name           : field name (defaults to field's numeric index)
		type           : for choosing a field template.

	rendering:
		text           : field name for display purposes (auto-generated default).
		visible        : field can be visible in a grid (true).

	navigation:
		focusable      : field can be focused (true).

	editing:
		client_default : default value that new rows are initialized with.
		server_default : default value that the server sets.
		editable       : allow modifying (true).
		editor         : f() -> editor instance
		from_text      : f(s) -> v
		to_text        : f(v) -> s
		enum_values    : [v1, ...]

	validation:
		allow_null     : allow null (true).
		validate       : f(v, field) -> undefined|err_string
		min            : min value (0).
		max            : max value (inf).
		maxlen         : max text length (256).
		multiple_of    : number that the value must be multiple of (1).
		max_digits     : max number of digits allowed.
		max_decimals   : max number of decimals allowed.

	formatting:
		align          : 'left'|'right'|'center'
		format         : f(v, row) -> s
		date_format    : toLocaleString format options for the date type
		true_text      : display value for boolean true
		false_text     : display value for boolean false
		null_text      : display value for null

	vlookup:
		lookup_rowset  : rowset to look up values of this field into
		lookup_col     : field in lookup_rowset that matches this field
		display_col    : field in lookup_rowset to use as display_value of this field.
		lookup_failed_display_value : f(v) -> s; what to use when lookup fails.

	sorting:
		sortable       : allow sorting (true).
		compare_types  : f(v1, v2) -> -1|0|1  (for sorting)
		compare_values : f(v1, v2) -> -1|0|1  (for sorting)

	grouping:
		group_by(col) -> group_rowset

	rs.rows: Set(row)
		row[i]             : current cell value (always valid).
		row.focusable      : row can be focused (true).
		row.editable       : allow modifying (true).
		row.input_val[i]   : currently set cell value, whether valid or not.
		row.error[i]       : error message if cell is invalid.
		row.row_error      : error message if row is invalid.
		row.modified[i]    : value was modified, change not on server yet.
		row.old_value[i]   : initial value before modifying.
		row.is_new         : new row, not added on server yet.
		row.cells_modified : one or more row cells were modified.
		row.removed        : removed row, not removed on server yet.

	rowset.types : {type -> {attr->val}}

	rowset.name_col   : default `display_col` of rowsets that lookup into this rowset.

*/

{
	let upper = function(s) {
		return s.toUpperCase()
	}
	let upper2 = function(s) {
		return ' ' + s.slice(1).toUpperCase()
	}
	function auto_display_name(s) {
		return (s || '').replace(/[\w]/, upper).replace(/(_[\w])/g, upper2)
	}
}

function widget_multiuser_mixin(e) {

	let refcount = 0

	e.bind_user_widget = function(user, on) {
		assert(user.typename) // must be a widget
		if (on)
			user_attached()
		else
			user_detached()
	}

	function user_attached() {
		refcount++
		if (refcount == 1) {
			e.isConnected = true
			e.attach()
		}
	}

	function user_detached() {
		refcount--
		assert(refcount >= 0)
		if (refcount == 0) {
			e.isConnected = false
			e.detach()
		}
	}

}

rowset = function(...options) {

	let d = {}

	d.can_edit        = true
	d.can_add_rows    = false
	d.can_remove_rows = false
	d.can_change_rows = false

	events_mixin(d)
	widget_multiuser_mixin(d)

	let field_map = new Map() // field_name->field

	d.field = function(name) {
		if (typeof name == 'number')
			return d.fields[name] // by index
		if (typeof name != 'string')
			return name // pass-through
		return field_map.get(name)
	}

	function init_fields(def) {

		let fields = def.fields
		d.fields = []
		if (!fields)
			return
		for (let i = 0; i < fields.length; i++) {
			let f = fields[i]
			let custom_attrs = d.field_attrs && d.field_attrs[f.name || i+'']
			let type = f.type || (custom_attrs && custom_attrs.type)
			let type_attrs = type && (d.types[type] || rowset.types[type])
			let field = update({index: i, rowset: d},
				rowset.all_types, d.all_types, type_attrs, f, custom_attrs)
			field.w = clamp(field.w, field.min_w, field.max_w)
			if (field.text == null)
				field.text = auto_display_name(field.name)
			field.name = field.name || i+''
			if (field.lookup_rowset)
				field.lookup_rowset = global_rowset(field.lookup_rowset)
			d.fields[i] = field
			field_map.set(field.name, field)
		}

		let pk = def.pk
		d.pk_fields = []
		if (pk) {
			if (typeof pk == 'string')
				pk = pk.split(' ')
			for (let col of pk) {
				let field = d.field(col)
				d.pk_fields.push(field)
				field.is_pk = true
			}
		}

		d.id_field = d.pk_fields.length == 1 && d.pk_fields[0]

		d.index_field = d.field(def.index_col)
	}

	function init_rows(rows) {
		d.rows = (!rows || isarray(rows)) && new Set(rows) || rows
		each_lookup('rebuild')
		init_tree()
	}

	property(d, 'row_count', { get: function() { return d.rows.size } })

	function init() {
		update(d, rowset, ...options) // set options/override.
		d.client_fields = d.fields
		init_fields(d)
		init_params()
		init_rows(d.rows)
	}

	d.attach = function() {
		bind_lookup_rowsets(true)
		bind_param_nav(true)
	}

	d.detach = function() {
		bind_lookup_rowsets(false)
		bind_param_nav(false)
		abort_ajax_requests()
	}

	// vlookup ----------------------------------------------------------------

	function lookup_function(field, on) {

		let index

		function lookup(v) {
			return index.get(v)
		}

		lookup.rebuild = function() {
			index = new Map()
			let fi = field.index
			for (let row of d.rows) {
				index.set(row[fi], row)
			}
		}

		lookup.row_added = function(row) {
			index.set(row[field.index], row)
		}

		lookup.row_removed = function(row) {
			index.delete(row[field.index])
		}

		lookup.val_changed = function(row, changed_field, val) {
			if (changed_field == field) {
				let prev_val = d.prev_val(row, field)
				index.delete(prev_val)
				index.set(val, row)
			}
		}

		lookup.rebuild()

		return lookup
	}

	d.lookup = function(field, v) {
		if (!field.lookup)
			field.lookup = lookup_function(field, true)
		return field.lookup(v)
	}

	function each_lookup(method, ...args) {
		if (d.fields)
			for (let field of d.fields)
				if (field.lookup)
					field.lookup[method](...args)
	}

	// tree -------------------------------------------------------------------

	d.each_child_row = function(row, f) {
		if (d.parent_field)
			for (let child_row of row.child_rows) {
				d.each_child_row(child_row, f) // depth-first
				f(child_row)
			}
	}

	function init_parents_for_row(row, parent_rows) {

		if (!init_parents_for_rows(row.child_rows))
			return // circular ref: abort.

		if (!parent_rows) {

			// reuse the parent rows array from a sibling, if any.
			let sibling_row = (row.parent_row || d).child_rows[0]
			parent_rows = sibling_row && sibling_row.parent_rows

			if (!parent_rows) {

				parent_rows = []
				let parent_row = row.parent_row
				while (parent_row) {
					if (parent_row == row || parent_rows.includes(parent_row))
						return // circular ref: abort.
					parent_rows.push(parent_row)
					parent_row = parent_row.parent_row
				}
			}
		}
		row.parent_rows = parent_rows
		return parent_rows
	}

	function init_parents_for_rows(rows) {
		let parent_rows
		for (let row of rows) {
			parent_rows = init_parents_for_row(row, parent_rows)
			if (!parent_rows)
				return // circular ref: abort.
		}
		return true
	}

	function remove_parent_rows_for(row) {
		row.parent_rows = null
		for (let child_row of row.child_rows)
			remove_parent_rows_for(child_row)
	}

	function remove_row_from_tree(row) {
		;(row.parent_row || d).child_rows.remove_value(row)
		if (row.parent_row && row.parent_row.child_rows.length == 0)
			delete row.parent_row.collapsed
		row.parent_row = null
		remove_parent_rows_for(row)
	}

	function add_row_to_tree(row, parent_row) {
		row.parent_row = parent_row
		;(parent_row || d).child_rows.push(row)
	}

	function init_tree() {

		d.parent_field = d.id_field && d.parent_col && d.field(d.parent_col)
		if (!d.parent_field)
			return

		d.child_rows = []
		for (let row of d.rows)
			row.child_rows = []

		let p_fi = d.parent_field.index
		for (let row of d.rows)
			add_row_to_tree(row, d.lookup(d.id_field, row[p_fi]))

		if (!init_parents_for_rows(d.child_rows)) {
			// circular refs detected: revert to flat mode.
			for (let row of d.rows) {
				row.child_rows = null
				row.parent_rows = null
				row.parent_row = null
				print('circular ref detected')
			}
			d.child_rows = null
			d.parent_field = null
		}

	}

	d.move_row = function(row, parent_row, ev) {
		if (!d.parent_field)
			return
		if (parent_row == row.parent_row)
			return
		assert(parent_row != row)
		assert(!parent_row || !parent_row.parent_rows.includes(row))

		let parent_id = parent_row ? d.val(parent_row, d.id_field) : null
		d.set_val(row, d.parent_field, parent_id, ev)

		remove_row_from_tree(row)
		add_row_to_tree(row, parent_row)

		assert(init_parents_for_row(row))
	}

	// collapsed state --------------------------------------------------------

	function set_parent_collapsed(row, collapsed) {
		for (let child_row of row.child_rows) {
			child_row.parent_collapsed = collapsed
			if (!child_row.collapsed)
				set_parent_collapsed(child_row, collapsed)
		}
	}

	function set_collapsed_all(row, collapsed) {
		if (row.child_rows.length > 0) {
			row.collapsed = collapsed
			for (let child_row of row.child_rows) {
				child_row.parent_collapsed = collapsed
				set_collapsed_all(child_row, collapsed)
			}
		}
	}

	d.set_collapsed = function(row, collapsed, recursive) {
		if (!row.child_rows.length)
			return
		if (recursive)
			set_collapsed_all(row, collapsed)
		else if (row.collapsed != collapsed) {
			row.collapsed = collapsed
			set_parent_collapsed(row, collapsed)
		}
	}

	// sorting ----------------------------------------------------------------

	d.compare_rows = function(row1, row2) {
		// invalid rows come first.
		if (row1.invalid != row2.invalid)
			return row1.invalid ? -1 : 1
		return 0
	}

	d.compare_types = function(v1, v2) {
		// nulls come first.
		if ((v1 === null) != (v2 === null))
			return v1 === null ? -1 : 1
		// NaNs come second.
		if ((v1 !== v1) != (v2 !== v2))
			return v1 !== v1 ? -1 : 1
		return 0
	}

	d.compare_vals = function(v1, v2) {
		return v1 !== v2 ? (v1 < v2 ? -1 : 1) : 0
	}

	function field_comparator(field) {

		let compare_rows = d.compare_rows
		let compare_types  = field.compare_types  || d.compare_types
		let compare_vals = field.compare_vals || d.compare_vals
		let field_index = field.index

		return function(row1, row2) {
			let r1 = compare_rows(row1, row2)
			if (r1) return r1

			let v1 = row1[field_index]
			let v2 = row2[field_index]

			let r2 = compare_types(v1, v2)
			if (r2) return r2

			return compare_vals(v1, v2)
		}
	}

	// order_by: [[field1,'desc'|'asc'],...]
	d.comparator = function(order_by) {

		order_by = new Map(order_by)

		// use index-based ordering by default, unless otherwise specified.
		if (d.index_field && order_by.size == 0)
			order_by.set(d.index_field, 'asc')

		// the tree-building comparator requires a stable sort order
		// for all parents so we must always compare rows by id after all.
		if (d.parent_field && !order_by.has(d.id_field))
			order_by.set(d.id_field, 'asc')

		let s = []
		let cmps = []
		for (let [field, dir] of order_by) {
			let i = field.index
			cmps[i] = field_comparator(field)
			let r = dir == 'desc' ? -1 : 1
			// invalid rows come first
			s.push('{')
			s.push('  let v1 = r1.row_error == null')
			s.push('  let v2 = r2.row_error == null')
			s.push('  if (v1 < v2) return -1')
			s.push('  if (v1 > v2) return  1')
			s.push('}')
			// invalid vals come after
			s.push('{')
			s.push('  let v1 = !(r1.error && r1.error['+i+'] != null)')
			s.push('  let v2 = !(r2.error && r2.error['+i+'] != null)')
			s.push('  if (v1 < v2) return -1')
			s.push('  if (v1 > v2) return  1')
			s.push('}')
			// modified rows come after
			s.push('{')
			s.push('  let v1 = !r1.cells_modified')
			s.push('  let v2 = !r2.cells_modified')
			s.push('  if (v1 < v2) return -1')
			s.push('  if (v1 > v2) return  1')
			s.push('}')
			// compare vals using the rowset comparator
			s.push('{')
			s.push('let cmp = cmps['+i+']')
			s.push('let r = cmp(r1, r2)')
			s.push('if (r) return r * '+r)
			s.push('}')
		}
		s.push('return 0')
		let cmp = 'let cmp = function(r1, r2) {\n\t' + s.join('\n\t') + '\n}\n; cmp;\n'

		// tree-building comparator: order elements by their position in the tree.
		if (d.parent_field) {
			// find the closest sibling ancestors of the two rows and compare them.
			let s = []
			s.push('let i1 = r1.parent_rows.length-1')
			s.push('let i2 = r2.parent_rows.length-1')
			s.push('while (i1 >= 0 && i2 >= 0 && r1.parent_rows[i1] == r2.parent_rows[i2]) { i1--; i2--; }')
			s.push('let p1 = i1 >= 0 ? r1.parent_rows[i1] : r1')
			s.push('let p2 = i2 >= 0 ? r2.parent_rows[i2] : r2')
			s.push('if (p1 == p2) return i1 < i2 ? -1 : 1') // one is parent of another.
			s.push('return cmp_direct(p1, p2)')
			cmp = cmp+'let cmp_direct = cmp; cmp = function(r1, r2) {\n\t' + s.join('\n\t') + '\n}\n; cmp;\n'
		}

		return eval(cmp)
	}

	// get/set cell & row state (storage api) ---------------------------------

	d.cell_state = function(row, field, key, default_val) {
		let v = row[key] && row[key][field.index]
		return v !== undefined ? v : default_val
	}

	d.set_cell_state = function(row, field, key, val, default_val) {
		let t = array_attr(row, key)
		let old_val = t[field.index]
		if (old_val === undefined)
			old_val = default_val
		let changed = old_val !== val
		if (changed)
			t[field.index] = val
		return changed
	}

	d.set_row_state = function(row, key, val, default_val, prop, ev) {
		let old_val = row[key]
		if (old_val === undefined)
			old_val = default_val
		let changed = old_val !== val
		if (changed)
			row[key] = val
		return changed
	}

	function cell_state_changed(row, field, prop, val, ev) {
		if (ev && ev.fire_changed_events === false)
			return
		d.fire('cell_state_changed', row, field, prop, val, ev)
		d.fire('cell_state_changed_for_'+field.name, row, prop, val, ev)
		d.fire(prop+'_changed', row, field, val, ev)
		d.fire(prop+'_changed_for_'+field.name, row, val, ev)
	}

	function row_state_changed(row, prop, val, ev) {
		d.fire('row_state_changed', row, prop, val, ev)
		d.fire(prop+'_changed', row, val, ev)
	}

	// filtering --------------------------------------------------------------

	d.filter_rowset = function(field, ...opt) {

		field = d.field(field)
		let rs_field = {}
		for (let k of [
			'name', 'text', 'type', 'align', 'min_w', 'max_w',
			'format', 'true_text', 'false_text', 'null_text',
			'lookup_rowset', 'lookup_col', 'display_col', 'lookup_failed_display_val',
			'sortable',
		])
			rs_field[k] = field[k]

		let rs = rowset({
			fields: [
				{text: '', type: 'bool'},
				rs_field,
			],
			filtered_field: field,
		}, ...opt)

		rs.reload = function() {
			let fi = field.index
			let rows = new Set()
			let val_set = new Set()
			for (let row of d.rows) {
				let v = row[fi]
				if (!val_set.has(v)) {
					rows.add([true, v])
					val_set.add(v)
				}
			}
			rs.rows = rows
			rs.fire('loaded')
		}

		return rs
	}

	d.row_filter = function(expr) {
		let expr_bin_ops = {'&&': 1, '||': 1}
		let expr_un_ops = {'!': 1}
		let s = []
		function push_expr(expr) {
			let op = expr[0]
			if (op in expr_bin_ops) {
				s.push('(')
				for (let i = 1; i < expr.length; i++) {
					if (i > 1)
						s.push(' '+op+' ')
					push_expr(expr[i])
				}
				s.push(')')
			} else if (op in expr_un_ops) {
				s.push('(')
				s.push(op)
				s.push('(')
				for (let i = 1; i < expr.length; i++)
					push_expr(expr[i])
				s.push('))')
			} else
				s.push('row['+d.field(expr[1]).index+'] '+expr[0]+' '+json(expr[2]))
		}
		push_expr(expr)
		s = 'let f = function(row) {\n\treturn ' + s.join('') + '\n}; f'
		return eval(s)
	}

	d.filter_rowsets_filter = function(filter_rowsets) {
		let expr = ['&&']
		if (filter_rowsets)
			for (let [field, rs] of filter_rowsets) {
				let e = ['&&']
				for (let row of rs.rows)
					if (!row[0])
						e.push(['!=', rs.filtered_field.index, row[1]])
				if (e.length > 1)
					expr.push(e)
			}
		return expr.length > 1 ? d.row_filter(expr) : return_true
	}

	// get/set cell vals and cell & row state ---------------------------------

	d.val = function(row, field) {
		return row[field.index]
	}

	d.input_val = function(row, field) {
		return d.cell_state(row, field, 'input_val', d.val(row, field))
	}

	d.old_val = function(row, field) {
		return d.cell_state(row, field, 'old_val', d.val(row, field))
	}

	d.prev_val = function(row, field) {
		return d.cell_state(row, field, 'prev_val', d.val(row, field))
	}

	d.validate_val = function(field, val, row, ev) {

		if (val == null)
			if (!field.allow_null)
				return S('error_not_null', 'NULL not allowed')
			else
				return

		if (field.min != null && val < field.min)
			return S('error_min_value', 'Value must be at least {0}').subst(field.min)

		if (field.max != null && val > field.max)
			return S('error_max_value', 'Value must be at most {0}').subst(field.max)

		let lr = field.lookup_rowset
		if (lr) {
			field.lookup_field = field.lookup_field || lr.field(field.lookup_col)
			field.display_field = field.display_field || lr.field(field.display_col || lr.name_col)
			if (!lr.lookup(field.lookup_field, val))
				return S('error_lookup', 'Value not found in lookup rowset')
		}

		let err = field.validate && field.validate.call(d, val, field)
		if (typeof err == 'string')
			return err

		return d.fire('validate_'+field.name, val, row, ev)
	}

	d.on_validate_val = function(col, validate, on) {
		d.on('validate_'+col, validate, on)
	}

	d.validate_row = function(row) {
		return d.fire('validate', row)
	}

	d.can_focus_cell = function(row, field) {
		return (!row || row.focusable != false) && (field == null || field.focusable != false)
	}

	d.can_change_val = function(row, field) {
		return d.can_edit && d.can_change_rows && (!row || row.editable != false)
			&& (field == null || field.editable)
			&& d.can_focus_cell(row, field)
	}

	d.can_have_children = function(row) {
		return row.can_have_children != false
	}

	d.create_row_editor = function(row, ...options) {} // stub

	d.create_editor = function(field, ...options) {
		if (field)
			return field.editor(...options)
		else
			return d.create_row_editor(...options)
	}

	d.cell_error = function(row, field) {
		return d.cell_state(row, field, 'error')
	}

	d.cell_modified = function(row, field) {
		return d.cell_state(row, field, 'modified', false)
	}

	d.set_row_error = function(row, err, ev) {
		err = typeof err == 'string' ? err : undefined
		if (err != null) {
			d.fire('notify', 'error', err)
			print(err)
		}
		if (d.set_row_state(row, 'row_error', err))
			row_state_changed(row, 'row_error', ev)
	}

	d.row_has_errors = function(row) {
		if (row.row_error != null)
			return true
		for (let field of d.fields)
			if (d.cell_error(row, field) != null)
				return true
		return false
	}

	d.set_val = function(row, field, val, ev) {
		if (val === undefined)
			val = null
		let err = d.validate_val(field, val, row, ev)
		err = typeof err == 'string' ? err : undefined
		let invalid = err != null
		let cur_val = row[field.index]
		let val_changed = !invalid && val !== cur_val

		let input_val_changed = d.set_cell_state(row, field, 'input_val', val, cur_val)
		let cell_err_changed = d.set_cell_state(row, field, 'error', err)
		let row_err_changed = d.set_row_state(row, 'row_error')

		if (val_changed) {
			let was_modified = d.cell_modified(row, field)
			let modified = val !== d.old_val(row, field)

			row[field.index] = val
			d.set_cell_state(row, field, 'prev_val', cur_val)
			if (!was_modified)
				d.set_cell_state(row, field, 'old_val', cur_val)
			let cell_modified_changed = d.set_cell_state(row, field, 'modified', modified, false)
			let row_modified_changed = modified && (!(ev && ev.row_not_modified))
				&& d.set_row_state(row, 'cells_modified', true, false)

			each_lookup('val_changed', row, field, val)

			cell_state_changed(row, field, 'val', val, ev)
			if (cell_modified_changed)
				cell_state_changed(row, field, 'cell_modified', modified, ev)
			if (row_modified_changed)
				row_state_changed(row, 'row_modified', true, ev)
			row_changed(row)
		}

		if (input_val_changed)
			cell_state_changed(row, field, 'input_val', val, ev)
		if (cell_err_changed)
			cell_state_changed(row, field, 'cell_error', err, ev)
		if (row_err_changed)
			row_state_changed(row, 'row_error', undefined, ev)

		return !invalid
	}

	d.reset_val = function(row, field, val, ev) {
		if (val === undefined)
			val = null
		let cur_val = row[field.index]
		let input_val_changed = d.set_cell_state(row, field, 'input_val', val, cur_val)
		let cell_modified_changed = d.set_cell_state(row, field, 'modified', false, false)
		d.set_cell_state(row, field, 'old_val', val)
		if (val !== cur_val) {
			row[field.index] = val
			d.set_cell_state(row, field, 'prev_val', cur_val)

			cell_state_changed(row, field, 'val', val, ev)
		}

		if (input_val_changed)
			cell_state_changed(row, field, 'input_val', val, ev)
		if (cell_modified_changed)
			cell_state_changed(row, field, 'cell_modified', false, ev)

	}

	// get/set display val ----------------------------------------------------

	function bind_lookup_rowsets(on) {
		for (let field of d.fields) {
			let lr = field.lookup_rowset
			if (lr) {
				if (on && !field.lookup_rowset_loaded) {
					field.lookup_rowset_loaded = function() {
						field.lookup_field  = lr.field(field.lookup_col)
						field.display_field = lr.field(field.display_col || lr.name_col)
						d.fire('display_vals_changed', field)
						d.fire('display_vals_changed_for_'+field.name)
					}
					field.lookup_rowset_display_vals_changed = function() {
						d.fire('display_vals_changed', field)
						d.fire('display_vals_changed_for_'+field.name)
					}
					field.lookup_rowset_loaded()
				}
				lr.on('loaded'      , field.lookup_rowset_loaded, on)
				lr.on('row_added'   , field.lookup_rowset_display_vals_changed, on)
				lr.on('row_removed' , field.lookup_rowset_display_vals_changed, on)
				lr.on('input_val_changed_for_'+field.lookup_col,
					field.lookup_rowset_display_vals_changed, on)
				lr.on('input_val_changed_for_'+(field.display_col || lr.name_col),
					field.lookup_rowset_display_vals_changed, on)
			}
		}
	}

	d.display_val = function(row, field) {
		let v = d.input_val(row, field)
		if (v == null)
			return field.null_text
		let lr = field.lookup_rowset
		if (lr) {
			let lf = field.lookup_field
			if (lf) {
				let row = lr.lookup(lf, v)
				if (row)
					return lr.display_val(row, field.display_field)
			}
			return field.lookup_failed_display_val(v)
		} else
			return field.format(v, row)
	}

	// add/remove/move rows ---------------------------------------------------

	function create_row() {
		let row = []
		// add server_default values or null
		for (let field of d.fields) {
			let val = field.server_default
			row.push(val != null ? val : null)
		}
		row.is_new = true
		return row
	}

	d.add_row = function(ev) {
		if (!d.can_add_rows)
			return
		let row = create_row()
		d.rows.add(row)

		if (d.parent_field) {
			row.child_rows = []
			row.parent_row = ev && ev.parent_row || null
			;(row.parent_row || d).child_rows.push(row)
			if (row.parent_row) {
				// silently set parent id to be the id of the parent row before firing `row_added` event.
				let parent_id = d.val(row.parent_row, d.id_field)
				d.set_val(row, d.parent_field, parent_id, update({fire_changed_events: false}, ev))
			}
			assert(init_parents_for_row(row))
		}

		each_lookup('row_added', row)
		d.fire('row_added', row, ev)

		// set default client values as if they were typed in by the user.
		let set_val_ev = update({row_not_modified: true}, ev)
		for (let field of d.fields)
			if (field.client_default != null)
				d.set_val(row, field, field.client_default, set_val_ev)

		row_changed(row)
		return row
	}

	d.can_remove_row = function(row) {
		if (!d.can_remove_rows)
			return false
		if (row.can_remove === false)
			return false
		if (row.is_new && row.save_request) {
			d.fire('notify', 'error',
				S('error_remove_while_saving',
					'Cannot remove a row that is in the process of being added to the server'))
			return false
		}
		return true
	}

	d.remove_row = function(row, ev) {
		if ((ev && ev.forever) || row.is_new) {
			d.each_child_row(row, function(row) {
				d.rows.delete(row)
			})
			d.rows.delete(row)
			remove_row_from_tree(row)
			each_lookup('row_removed', row)
			d.fire('row_removed', row, ev)
		} else {
			if (!d.can_remove_row(row))
				return
			d.each_child_row(row, function(row) {
				if (d.set_row_state(row, 'removed', true, false))
					row_state_changed(row, 'row_removed', ev)
			})
			if (d.set_row_state(row, 'removed', true, false))
				row_state_changed(row, 'row_removed', ev)
			row_changed(row)
		}
		return row
	}

	// ajax requests ----------------------------------------------------------

	let requests

	function add_request(req) {
		if (!requests)
			requests = new Set()
		requests.add(req)
	}

	function abort_ajax_requests() {
		if (requests)
			for (let req of requests)
				req.abort()
	}

	// params -----------------------------------------------------------------

	function init_params() {

		if (typeof d.param_names == 'string')
			d.param_names = d.param_names.split(' ')
		else if (!d.param_names)
			d.param_names = []

		bind_param_nav(false)

		if (d.param_names.length == 0)
			return

		if (!d.param_nav) {
			let param_fields = []
			let params_row = []
			for (let param of d.param_names) {
				param_fields.push({
					name: param,
				})
				params_row.push(null)
			}
			let params_rowset = rowset({fields: param_fields, rows: [params_row]})
			d.param_nav = rowset_nav({rowset: params_rowset})
		}

		if (d.isConnected)
			bind_param_nav(true)
	}

	function params_changed(row) {
		d.reload()
	}

	function bind_param_nav(on) {
		if (!d.param_nav)
			return
		if (!d.param_names || !d.param_names.length)
			return
		d.param_nav.on('focused_row_changed', params_changed, on)
		for (let param of d.param_names)
			d.param_nav.on('focused_row_val_changed_for_'+param, params_changed, on)
	}

	function make_url(params) {
		if (!d.param_nav)
			return d.url
		if (!params) {
			params = {}
			for (let param of d.param_names) {
				let field = d.param_nav.rowset.field(param)
				let row = d.param_nav.focused_row
				let v = row ? d.param_nav.rowset.val(row, field) : null
				params[field.name] = v
			}
		}
		return url(d.url, {params: json(params)})
	}

	// loading ----------------------------------------------------------------

	d.reload = function(params) {
		params = or(params, d.params)
		if (!d.url)
			return
		if (requests && requests.size && !d.load_request) {
			d.fire('notify', 'error',
				S('error_load_while_saving', 'Cannot reload while saving is in progress.'))
			return
		}
		d.abort_loading()
		let req = ajax({
			url: make_url(params),
			progress: load_progress,
			success: d.reset,
			fail: load_fail,
			done: load_done,
			slow: load_slow,
			slow_timeout: d.slow_timeout,
		})
		add_request(req)
		d.load_request = req
		d.loading = true
		d.fire('loading', true)
		req.send()
	}

	d.load = function() {
		d.load = noop
		d.reload()
	}

	d.load_fields = function() {
		d.load_fields = noop
		d.reload(update({limit: 0}, d.params))
	}

	d.abort_loading = function() {
		if (!d.load_request)
			return
		d.load_request.abort()
		d.load_request = null
	}

	function load_progress(p, loaded, total) {
		d.fire('load_progress', p, loaded, total)
	}

	function load_slow(show) {
		d.fire('load_slow', show)
	}

	function load_done() {
		requests.delete(this)
		d.load_request = null
		d.loading = false
		d.fire('loading', false)
	}

	function check_fields(server_fields) {
		if (!isarray(d.client_fields))
			return true
		let fi = 0
		let ok = false
		if (d.client_fields.length == server_fields.length) {
			for (sf of server_fields) {
				let cf = d.client_fields[fi]
				if (cf.name != sf.name)
					break
				if (cf.type != sf.type)
					break
				fi++
			}
			ok = true
		}
		if (!ok)
			d.fire('notify', 'error', 'Client fields do not match server fields')
		return ok
	}

	d.reset = function(res) {

		d.changed_rows = null

		d.can_edit        = or(res.can_edit         , d.can_edit)
		d.can_add_rows    = or(res.can_add_rows     , d.can_add_rows)
		d.can_remove_rows = or(res.can_remove_rows  , d.can_remove_rows)
		d.can_change_rows = or(res.can_change_rows  , d.can_change_rows)

		if (res.fields) {
			if (!check_fields(res.fields))
				return
			init_fields(res)
			d.id_col = res.id_col
		}

		if (res.params) {
			d.param_names = res.params
			init_params()
		}

		init_rows(res.rows)

		d.fire('loaded', !!res.fields)
	}

	function load_fail(type, status, message, body) {
		let err
		if (type == 'http')
			err = S('error_http', 'Server returned {0} {1}').subst(status, message)
		else if (type == 'network')
			err = S('error_load_network', 'Loading failed: network error.')
		else if (type == 'timeout')
			err = S('error_load_timeout', 'Loading failed: timed out.')
		if (err)
			d.fire('notify', 'error', err, body)
		d.fire('load_fail', err, type, status, message, body)
	}

	// saving changes ---------------------------------------------------------

	function row_changed(row) {
		if (row.is_new)
			if (!row.row_modified)
				return
			else assert(!row.removed)
		d.changed_rows = d.changed_rows || new Set()
		d.changed_rows.add(row)
		d.fire('row_changed', row)
	}

	function add_row_changes(row, rows) {
		if (row.save_request)
			return // currently saving this row.
		if (row.is_new) {
			let t = {type: 'new', values: {}}
			for (let fi = 0; fi < d.fields.length; fi++) {
				let field = d.fields[fi]
				let val = row[fi]
				if (val !== field.server_default)
					t.values[field.name] = val
			}
			rows.push(t)
		} else if (row.removed) {
			let t = {type: 'remove', values: {}}
			for (let field of d.pk_fields)
				t.values[field.name] = d.old_val(row, field)
			rows.push(t)
		} else if (row.cells_modified) {
			let t = {type: 'update', values: {}}
			let found
			for (let field of d.fields) {
				if (d.cell_modified(row, field)) {
					t.values[field.name] = row[field.index]
					found = true
				}
			}
			if (found) {
				for (let field of d.pk_fields)
					t.values[field.name+':old'] = d.old_val(row, field)
				rows.push(t)
			}
		}
	}

	d.pack_changes = function(row) {
		let changes = {rows: []}
		if (d.id_col)
			changes.id_col = d.id_col
		if (!row) {
			for (let row of d.changed_rows)
				add_row_changes(row, changes.rows)
		} else
			add_row_changes(row, changes.rows)
		return changes
	}

	d.apply_result = function(result, changed_rows) {
		for (let i = 0; i < result.rows.length; i++) {
			let rt = result.rows[i]
			let row = changed_rows[i]

			let err = typeof rt.error == 'string' ? rt.error : undefined
			let row_failed = rt.error != null
			d.set_row_error(row, err)

			if (rt.remove) {
				d.remove_row(row, {forever: true, refocus: true})
			} else {
				if (!row_failed) {
					if (d.set_row_state(row, 'is_new', false, false))
						row_state_changed(row, 'row_is_new', false)
					if (d.set_row_state(row, 'cells_modified', false, false))
						row_state_changed(row, 'row_modified', false)
				}
				if (rt.field_errors) {
					for (let k in rt.field_errors) {
						let field = d.field(k)
						let err = rt.field_errors[k]
						err = typeof err == 'string' ? err : undefined
						if (d.set_cell_state(row, field, 'error', err))
							cell_state_changed(row, field, 'cell_error', err)
					}
				} else {
					if (rt.values)
						for (let k in rt.values)
							d.reset_val(row, d.field(k), rt.values[k])
				}
			}
		}
		if (result.sql_trace && result.sql_trace.length)
			print(result.sql_trace.join('\n'))
	}

	function set_save_state(rows, req) {
		for (let row of d.rows)
			d.set_row_state(row, 'save_request', req)
	}

	d.save_to_url = function(row, url) {
		let req = ajax({
			url: url,
			upload: d.pack_changes(row),
			changed_rows: Array.from(d.changed_rows),
			success: save_success,
			fail: save_fail,
			done: save_done,
			slow: save_slow,
			slow_timeout: d.slow_timeout,
		})
		d.changed_rows = null
		add_request(req)
		set_save_state(req.rows, req)
		d.fire('saving', true)
		req.send()
	}

	d.save = function(row) {
		if (!d.changed_rows)
			return
		if (d.url)
			d.save_to_url(d.url, row)
	}

	function save_slow(show) {
		d.fire('saving_slow', show)
	}

	function save_done() {
		requests.delete(this)
		set_save_state(this.rows, null)
		d.fire('saving', false)
	}

	function save_success(result) {
		d.apply_result(result, this.changed_rows)
	}

	function save_fail(type, status, message, body) {
		let err
		if (type == 'http')
			err = S('error_http', 'Server returned {0} {1}').subst(status, message)
		else if (type == 'network')
			err = S('error_save_network', 'Saving failed: network error.')
		else if (type == 'timeout')
			err = S('error_save_timeout', 'Saving failed: timed out.')
		if (err)
			d.fire('notify', 'error', err, body)
		d.fire('save_fail', err, type, status, message, body)
	}

	d.revert = function() {
		if (!d.changed_rows)
			return
			/*
		for (let row of d.changed_rows)
			if (row.is_new)
				//
			else if (row.removed)
				//
			else if (row.cells_modified)
				//
			*/
		d.changed_rows = null
	}

	init()

	return d
}

function global_rowset(name, ...options) {
	let d = name
	if (typeof name == 'string') {
		d = global_rowset[name]
		if (!d) {
			d = rowset({url: 'rowset.json/'+name}, ...options)
			global_rowset[name] = d
		}
	}
	return d
}

// ---------------------------------------------------------------------------
// field types
// ---------------------------------------------------------------------------

{

	rowset.all_types = {
		w: 100,
		min_w: 20,
		max_w: 2000,
		align: 'left',
		allow_null: true,
		editable: true,
		sortable: true,
		maxlen: 256,
		true_text: () => H('<div class="fa fa-check"></div>'),
		false_text: '',
		null_text: S('null', 'null'),
		lookup_failed_display_val: function(v) {
			return this.format(v)
		},
	}

	rowset.all_types.format = function(v) {
		return String(v)
	}

	rowset.all_types.editor = function(...options) {
		return input({nolabel: true}, ...options)
	}

	rowset.all_types.to_text = function(v) {
		return v != null ? String(v) : ''
	}

	rowset.all_types.from_text = function(s) {
		s = s.trim()
		return s !== '' ? s : null
	}

	rowset.types = {
		number: {align: 'right', min: 0, max: 1/0, multiple_of: 1},
		date  : {align: 'right', min: -(2**52), max: 2**52},
		bool  : {align: 'center'},
		enum  : {},
	}

	// numbers

	rowset.types.number.validate = function(val, field) {
		val = parseFloat(val)

		if (typeof val != 'number' || val !== val)
			return S('error_invalid_number', 'Invalid number')

		if (field.multiple_of != null)
			if (val % field.multiple_of != 0) {
				if (field.multiple_of == 1)
					return S('error_integer', 'Value must be an integer')
				return S('error_multiple', 'Value must be multiple of {0}').subst(field.multiple_of)
			}
	}

	rowset.types.number.editor = function(...options) {
		return spin_input(update({
			nolabel: true,
			button_placement: 'left',
		}, ...options))
	}

	rowset.types.number.from_text = function(s) {
		return num(s)
	}

	rowset.types.number.to_text = function(x) {
		return x != null ? String(x) : ''
	}

	// dates

	rowset.types.date.validate = function(val, field) {
		if (typeof val != 'number' || val !== val)
			return S('error_date', 'Invalid date')
	}

	rowset.types.date.format = function(t) {
		_d.setTime(t)
		return _d.toLocaleString(locale, this.date_format)
	}

	rowset.types.date.date_format =
		{weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }

	rowset.types.date.editor = function(...options) {
		return date_dropdown(update({
			nolabel: true,
			align: 'right',
			mode: 'fixed',
		}, ...options))
	}

	// booleans

	rowset.types.bool.validate = function(val, field) {
		if (typeof val != 'boolean')
			return S('error_boolean', 'Value not true or false')
	}

	rowset.types.bool.format = function(val) {
		return val ? this.true_text : this.false_text
	}

	rowset.types.bool.editor = function(...options) {
		return checkbox(update({
			center: true,
		}, ...options))
	}

	// enums

	rowset.types.enum.editor = function(...options) {
		return list_dropdown(update({
			nolabel: true,
			items: this.enum_values,
		}, ...options))
	}

}

// ---------------------------------------------------------------------------
// serializable widget mixin
// ---------------------------------------------------------------------------

function serializable_widget(e) {

	e.serialize_fields = function() {
		let t = {typename: e.typename}
		if (e.props)
			for (let prop in e.props) {
				let v = e[prop]
				let def = e.props[prop]
				if (v !== def.default) {
					if (def.serialize)
						v = def.serialize(v)
					else if (v !== null && typeof v == 'object' && v.typename && v.serialize) {
						attr(t, 'components')[prop] = true
						v = v.serialize()
					}
					if (v !== undefined)
						t[prop] = v
				}
			}
		return t
	}

	e.serialize = e.serialize_fields

}

// ---------------------------------------------------------------------------
// cssgrid child widget mixin
// ---------------------------------------------------------------------------

function cssgrid_child_widget(e) {

	e.property('parent_widget', function() {
		let parent = this.parent
		while (parent) {
			if (parent.child_widgets)
				return parent
			parent = parent.parent
		}
	})

	e.prop('pos_x'  , {style: 'grid-column-start' , type: 'number', default: 1})
	e.prop('pos_y'  , {style: 'grid-row-start'    , type: 'number', default: 1})
	e.prop('span_x' , {style: 'grid-column-end'   , type: 'number', default: 1, style_format: (v) => 'span '+v, style_parse: (v) => num((v || 'span 1').replace('span ', '')) })
	e.prop('span_y' , {style: 'grid-row-end'      , type: 'number', default: 1, style_format: (v) => 'span '+v, style_parse: (v) => num((v || 'span 1').replace('span ', '')) })
	e.prop('align_x', {style: 'justify-self'      , type: 'enum', enum_values: ['start', 'end', 'center', 'stretch'], default: 'center'})
	e.prop('align_y', {style: 'align-self'        , type: 'enum', enum_values: ['start', 'end', 'center', 'stretch'], default: 'center'})

}

// ---------------------------------------------------------------------------
// focusable widget mixin ----------------------------------------------------
// ---------------------------------------------------------------------------

function tabindex_widget(e) {
	e.prop('tabindex', {attr: 'tabindex', default: 0})
}

// ---------------------------------------------------------------------------
// val widget mixin
// ---------------------------------------------------------------------------

/*
	val widgets must implement:
		field_prop_map: {prop->field_prop}
		update_val(input_val, ev)
		update_error(err, ev)
*/

function val_widget(e) {

	cssgrid_child_widget(e)
	serializable_widget(e)

	e.default_val = null
	e.field_prop_map = {
		field_name: 'name', field_type: 'type', label: 'text',
		format: 'format',
		min: 'min', max: 'max', maxlen: 'maxlen', multiple_of: 'multiple_of',
		lookup_rowset: 'lookup_rowset', lookup_col: 'lookup_col', display_col: 'display_col',
	}

	e.init_nav = function() {
		if (!e.nav) {
			// create an internal one-row-one-field rowset.

			// transfer value of e.foo to field.bar based on field_prop_map.
			let field = {}
			for (let e_k in e.field_prop_map) {
				let field_k = e.field_prop_map[e_k]
				if (e_k in e)
					field[field_k] = e[e_k]
			}

			let row = [e.default_val]

			let internal_rowset = rowset({
				fields: [field],
				rows: [row],
				can_change_rows: true,
			})

			// create a fake navigator.

			e.nav = {rowset: internal_rowset, focused_row: row, is_fake: true}

			e.field = e.nav.rowset.field(0)
			e.col = e.field.name

			if (e.validate) // inline validator, only for internal-rowset widgets.
				e.nav.rowset.on_validate_val(e.col, e.validate)

			e.init_field()
		} else if (e.nav !== true) {
			if (e.field)
				e.col = e.field.name
			if (e.col == null)
				e.col = 0
			e.field = e.nav.rowset.field(e.col)
			e.init_field()
		}
	}

	function rowset_cell_state_changed(row, field, prop, val, ev) {
		cell_state_changed(prop, val, ev)
	}

	e.bind_nav = function(on) {
		if (e.nav.is_fake) {
			e.nav.rowset.bind_user_widget(e, on)
			e.nav.rowset.on('cell_state_changed', rowset_cell_state_changed, on)
		} else {
			e.nav.on('focused_row_changed', e.init_val, on)
			e.nav.on('focused_row_cell_state_changed_for_'+e.col, cell_state_changed, on)
		}
		e.nav.rowset.on('display_vals_changed_for_'+e.col, e.init_val, on)
		e.nav.rowset.on('loaded', rowset_loaded, on)
	}

	e.rebind_val = function(nav, col) {
		if (e.isConnected)
			e.bind_nav(false)
		e.nav = nav
		e.col = col
		e.field = e.nav.rowset.field(e.col)
		e.init_field()
		if (e.isConnected) {
			e.bind_nav(true)
			e.init_val()
		}
	}

	e.init_field = function() {} // stub

	function rowset_loaded() {
		e.field = e.nav.rowset.field(e.col)
		e.init_field()
	}

	e.init_val = function() {
		cell_state_changed('input_val', e.input_val)
		cell_state_changed('val', e.val)
		cell_state_changed('cell_error', e.error)
		cell_state_changed('cell_modified', e.modified)
	}

	function cell_state_changed(prop, val, ev) {
		if (prop == 'input_val')
			e.update_val(val, ev)
		else if (prop == 'val')
			e.fire('val_changed', val, ev)
		else if (prop == 'cell_error') {
			e.invalid = val != null
			e.class('invalid', e.invalid)
			e.update_error(val, ev)
		} else if (prop == 'cell_modified')
			e.class('modified', val)
	}

	e.error_tooltip_check = function() {
		return e.invalid && !e.hasclass('picker')
			&& (e.hasfocus || e.hovered)
	}

	e.update_error = function(err) {
		if (!e.error_tooltip) {
			if (!e.invalid)
				return // don't create it until needed.
			e.error_tooltip = tooltip({kind: 'error', target: e,
				check: e.error_tooltip_check})
		}
		if (e.invalid)
			e.error_tooltip.text = err
		e.error_tooltip.update()
	}

	// getters/setters --------------------------------------------------------

	e.to_val = function(v) { return v; }
	e.from_val = function(v) { return v; }

	function get_val() {
		let row = e.nav.focused_row
		return row ? e.nav.rowset.val(row, e.field) : null
	}
	e.set_val = function(v, ev) {
		let row = e.nav.focused_row
		if (!row)
			return
		e.nav.rowset.set_val(row, e.field, e.to_val(v), ev)
	}
	e.late_property('val', get_val, e.set_val)

	e.property('input_val', function() {
		let row = e.nav.focused_row
		return row ? e.from_val(e.nav.rowset.input_val(row, e.field)) : null
	})

	e.property('error', function() {
		let row = e.nav.focused_row
		return row ? e.nav.rowset.cell_error(row, e.field) : undefined
	})

	e.property('modified', function() {
		let row = e.nav.focused_row
		return row ? e.nav.rowset.cell_modified(row, e.field) : false
	})

	e.display_val = function() {
		let row = e.nav.focused_row
		return row ? e.nav.rowset.display_val(row, e.field) : ''
	}

}

// ---------------------------------------------------------------------------
// tooltip
// ---------------------------------------------------------------------------

component('x-tooltip', function(e) {

	e.classes = 'x-widget x-tooltip'

	e.text_div = div({class: 'x-tooltip-text'})
	e.pin = div({class: 'x-tooltip-tip'})
	e.add(e.text_div, e.pin)

	e.attrval('side', 'top')
	e.attrval('align', 'center')

	let target

	e.popup_target_changed = function(target) {
		let visible = !!(!e.check || e.check(target))
		e.class('visible', visible)
	}

	e.update = function() {
		e.popup(target, e.side, e.align, e.px, e.py)
	}

	function set_timeout_timer() {
		let t = e.timeout
		if (t == 'auto')
			t = clamp(e.text.length / (tooltip.reading_speed / 60), 1, 10)
		else
			t = num(t)
		if (t != null)
			after(t, function() { e.target = false })
	}

	e.late_property('text',
		function()  { return e.text_div.textContent },
		function(s) {
			e.text_div.set(s, 'pre-wrap')
			e.update()
			set_timeout_timer()
		}
	)

	e.property('visible',
		function()  { return e.style.display != 'none' },
		function(v) { e.show(v); e.update() }
	)

	e.attr_property('side'    , e.update)
	e.attr_property('align'   , e.update)
	e.attr_property('kind'    , e.update)
	e.num_attr_property('px'  , e.update)
	e.num_attr_property('py'  , e.update)
	e.attr_property('timeout')

	e.late_property('target',
		function()  { return target },
		function(v) { target = v; e.update() }
	)

})

tooltip.reading_speed = 800 // letters-per-minute.

// ---------------------------------------------------------------------------
// button
// ---------------------------------------------------------------------------

component('x-button', function(e) {

	cssgrid_child_widget(e)
	serializable_widget(e)
	tabindex_widget(e)

	e.classes = 'x-widget x-button'

	e.icon_div = span({class: 'x-button-icon', style: 'display: none'})
	e.text_div = span({class: 'x-button-text'})
	e.add(e.icon_div, e.text_div)

	e.get_text = function()  { return e.text_div.html }
	e.set_text = function(s) { e.text_div.set(s) }
	e.prop('text', {default: 'OK'})

	e.set_icon = function(v) {
		if (typeof v == 'string')
			e.icon_div.attr('class', 'x-button-icon '+v)
		else
			e.icon_div.set(v)
		e.icon_div.show(!!v)
	}
	e.prop('icon', {store: 'var'})

	e.prop('primary', {attr: 'primary', type: 'bool', default: false})

	e.on('keydown', function keydown(key) {
		if (key == ' ' || key == 'Enter') {
			e.class('active', true)
			return false
		}
	})

	e.on('keyup', function keyup(key) {
		if (e.hasclass('active')) {
			// ^^ always match keyups with keydowns otherwise we might catch
			// a keyup from someone else's keydown, eg. a dropdown menu item
			// could've been selected by pressing Enter which closed the menu
			// and focused this button back and that Enter's keyup got here.
			if (key == ' ' || key == 'Enter') {
				e.click()
				e.class('active', false)
			}
			return false
		}
	})

	e.on('click', function() {
		if(e.action)
			e.action()
		e.fire('action')
	})

})

// ---------------------------------------------------------------------------
// checkbox
// ---------------------------------------------------------------------------

component('x-checkbox', function(e) {

	tabindex_widget(e)

	e.classes = 'x-widget x-markbox x-checkbox'
	e.prop('align', {attr: 'align', type: 'enum', enum_values: ['left', 'right'], default: 'left'})

	e.checked_val = true
	e.unchecked_val = false

	e.icon_div = span({class: 'x-markbox-icon x-checkbox-icon far fa-square'})
	e.text_div = span({class: 'x-markbox-text x-checkbox-text'})
	e.add(e.icon_div, e.text_div)

	// model

	val_widget(e)

	e.init = function() {
		e.init_nav()
		e.class('center', !!e.center)
	}

	e.attach = function() {
		e.init_val()
		e.bind_nav(true)
	}

	e.detach = function() {
		e.bind_nav(false)
	}

	let get_checked = function() {
		return e.val === e.checked_val
	}
	let set_checked = function(v) {
		e.set_val(v ? e.checked_val : e.unchecked_val, {input: e})
	}
	e.property('checked', get_checked, set_checked)

	// view

	e.get_text = function()  { return e.text_div.html }
	e.set_text = function(s) { e.text_div.set(s) }
	e.prop('text')

	e.update_val = function() {
		let v = e.checked
		e.class('checked', v)
		e.icon_div.class('fa', v)
		e.icon_div.class('fa-check-square', v)
		e.icon_div.class('far', !v)
		e.icon_div.class('fa-square', !v)
	}

	// controller

	e.toggle = function() {
		e.checked = !e.checked
	}

	e.on('pointerdown', function(ev) {
		ev.preventDefault() // prevent accidental selection by double-clicking.
		e.focus()
	})

	e.on('click', function() {
		e.toggle()
		return false
	})

	e.on('keydown', function(key) {
		if (key == 'Enter' || key == ' ') {
			e.toggle()
			return false
		}
	})

})

// ---------------------------------------------------------------------------
// radiogroup
// ---------------------------------------------------------------------------

component('x-radiogroup', function(e) {

	e.classes = 'x-widget x-radiogroup'
	e.prop('align', {attr: 'align', type: 'enum', enum_values: ['left', 'right'], default: 'left'})

	val_widget(e)

	e.items = []

	e.init = function() {
		e.init_nav()
		for (let item of e.items) {
			if (typeof item == 'string' || item instanceof Node)
				item = {text: item}
			let radio_div = span({class: 'x-markbox-icon x-radio-icon far fa-circle'})
			let text_div = span({class: 'x-markbox-text x-radio-text'})
			text_div.set(item.text)
			let idiv = div({class: 'x-widget x-markbox x-radio-item', tabindex: 0},
				radio_div, text_div)
			idiv.attrval('align', e.align)
			idiv.class('center', !!e.center)
			idiv.item = item
			idiv.on('click', idiv_click)
			idiv.on('keydown', idiv_keydown)
			e.add(idiv)
		}
	}

	e.attach = function() {
		e.init_val()
		e.bind_nav(true)
	}

	e.detach = function() {
		e.bind_nav(false)
	}

	let sel_item

	e.update_val = function(i) {
		if (sel_item) {
			sel_item.class('selected', false)
			sel_item.at[0].class('fa-dot-circle', false)
			sel_item.at[0].class('fa-circle', true)
		}
		sel_item = i != null ? e.at[i] : null
		if (sel_item) {
			sel_item.class('selected', true)
			sel_item.at[0].class('fa-dot-circle', true)
			sel_item.at[0].class('fa-circle', false)
		}
	}

	function select_item(item) {
		e.set_val(item.index, {input: e})
		item.focus()
	}

	function idiv_click() {
		select_item(this)
		return false
	}

	function idiv_keydown(key) {
		if (key == ' ' || key == 'Enter') {
			select_item(this)
			return false
		}
		if (key == 'ArrowUp' || key == 'ArrowDown') {
			let item = e.focused_element
			let next_item = item
				&& (key == 'ArrowUp' ? (item.prev || e.last) : (item.next || e.first))
			if (next_item)
				select_item(next_item)
			return false
		}
	}

})

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

function input_widget(e) {

	e.prop('align', {attr: 'align', type: 'enum', enum_values: ['left', 'right'], default: 'left'})
	e.prop('mode', {attr: 'mode', type: 'enum', enum_values: ['default', 'inline'], default: 'default'})

	function update_inner_label() {
		e.class('with-inner-label', !e.nolabel && e.field && !!e.field.text)
	}

	e.class('with-inner-label', true)
	e.bool_attr_property('nolabel', update_inner_label)

	e.init_field = function() {
		update_inner_label()
		e.inner_label_div.set(e.field.text)
	}

}

component('x-input', function(e) {

	e.classes = 'x-widget x-input'

	e.input = H.input({class: 'x-input-value'})
	e.inner_label_div = div({class: 'x-input-inner-label'})
	e.input.set_input_filter() // must be set as first event handler!
	e.add(e.input, e.inner_label_div)

	val_widget(e)
	input_widget(e)

	e.init = function() {
		e.init_nav()
	}

	e.attach = function() {
		e.init_val()
		e.bind_nav(true)
	}

	e.detach = function() {
		e.bind_nav(false)
	}

	function update_state(s) {
		e.input.class('empty', s == '')
		e.inner_label_div.class('empty', s == '')
	}

	e.from_text = function(s) { return e.field.from_text(s) }
	e.to_text = function(v) { return e.field.to_text(v) }

	e.update_val = function(v, ev) {
		if (ev && ev.input == e && e.typing)
			return
		let s = e.to_text(v)
		e.input.value = s
		update_state(s)
	}

	e.input.on('input', function() {
		e.set_val(e.from_text(e.input.value), {input: e, typing: true})
		update_state(e.input.value)
	})

	e.input.input_filter = function(s) {
		return s.length <= or(e.maxlen, e.field.maxlen)
	}

	// grid editor protocol ---------------------------------------------------

	e.focus = function() {
		e.input.focus()
	}

	e.input.on('blur', function() {
		e.fire('lost_focus')
	})

	let editor_state

	function update_editor_state(moved_forward, i0, i1) {
		i0 = or(i0, e.input.selectionStart)
		i1 = or(i1, e.input.selectionEnd)
		let anchor_left =
			e.input.selectionDirection != 'none'
				? e.input.selectionDirection == 'forward'
				: (moved_forward || e.align == 'left')
		let imax = e.input.value.length
		let leftmost  = i0 == 0
		let rightmost = (i1 == imax || i1 == -1)
		if (anchor_left) {
			if (rightmost) {
				if (i0 == i1)
					i0 = -1
				i1 = -1
			}
		} else {
			i0 = i0 - imax - 1
			i1 = i1 - imax - 1
			if (leftmost) {
				if (i0 == 1)
					i1 = 0
				i0 = 0
			}
		}
		editor_state = [i0, i1]
	}

	e.input.on('keydown', function(key, shift, ctrl) {
		// NOTE: we capture Ctrl+A on keydown because the user might
		// depress Ctrl first and when we get the 'a' Ctrl is not pressed.
		if (key == 'a' && ctrl)
			update_editor_state(null, 0, -1)
	})

	e.input.on('keyup', function(key, shift, ctrl) {
		if (key == 'ArrowLeft' || key == 'ArrowRight')
			update_editor_state(key == 'ArrowRight')
	})

	e.editor_state = function(s) {
		if (s) {
			let i0 = e.input.selectionStart
			let i1 = e.input.selectionEnd
			let imax = e.input.value.length
			let leftmost  = i0 == 0
			let rightmost = i1 == imax
			if (s == 'left')
				return i0 == i1 && leftmost && 'left'
			else if (s == 'right')
				return i0 == i1 && rightmost && 'right'
		} else {
			if (!editor_state)
				update_editor_state()
			return editor_state
		}
	}

	e.enter_editor = function(s) {
		if (!s)
			return
		if (s == 'select_all')
			s = [0, -1]
		else if (s == 'left')
			s = [0, 0]
		else if (s == 'right')
			s = [-1, -1]
		editor_state = s
		let [i0, i1] = s
		let imax = e.input.value.length
		if (i0 < 0) i0 = imax + i0 + 1
		if (i1 < 0) i1 = imax + i1 + 1
		e.input.select(i0, i1)
	}

})

// ---------------------------------------------------------------------------
// spin_input
// ---------------------------------------------------------------------------

component('x-spin-input', function(e) {

	input.construct(e)
	e.classes = 'x-spin-input'

	e.align = 'right'

	e.prop('button_style'    , {attr: 'button-style'    , type: 'enum', enum_values: ['plus-minus', 'up-down', 'left-right'], default: 'plus-minus'})
	e.prop('button_placement', {attr: 'button-placement', type: 'enum', enum_values: ['each-side', 'left', 'right'], default: 'each-side'})

	e.up   = div({class: 'x-spin-input-button fa'})
	e.down = div({class: 'x-spin-input-button fa'})

	e.field_type = 'number'
	update(e.field_prop_map, {field_type: 'type'})

	let init_input = e.init
	e.init = function() {

		init_input()

		let bs = e.button_style
		let bp = e.button_placement

		if (bs == 'plus-minus') {
			e.up  .class('fa-plus')
			e.down.class('fa-minus')
			bp = bp || 'each-side'
		} else if (bs == 'up-down') {
			e.up  .class('fa-caret-up')
			e.down.class('fa-caret-down')
			bp = bp || 'left'
		} else if (bs == 'left-right') {
			e.up  .class('fa-caret-right')
			e.down.class('fa-caret-left')
			bp = bp || 'each-side'
		}

		if (bp == 'each-side') {
			e.insert(0, e.down)
			e.add(e.up)
			e.down.class('left' )
			e.up  .class('right')
			e.down.class('leftmost' )
			e.up  .class('rightmost')
		} else if (bp == 'right') {
			e.add(e.down, e.up)
			e.down.class('right')
			e.up  .class('right')
			e.up  .class('rightmost')
		} else if (bp == 'left') {
			e.insert(0, e.down, e.up)
			e.down.class('left')
			e.up  .class('left')
			e.down.class('leftmost' )
		}

	}

	// controller

	let input_filter = e.input.input_filter
	e.input.input_filter = function(s) {
		if (!input_filter(s))
			return false
		if (or(e.min, e.field.min) >= 0)
			if (/\-/.test(s))
				return false // no minus
		let max_dec = or(e.max_decimals, e.field.max_decimals)
		if (or(e.multiple_of, e.field.multiple_of) == 1)
			max_dec = 0
		if (max_dec == 0)
			if (/\./.test(s))
				return false // no dots
		if (max_dec != null) {
			let m = s.match(/\.(\d+)$/)
			if (m != null && m[1].length > max_dec)
				return false // too many decimals
		}
		let max_digits = or(e.max_digits, e.field.max_digits)
		if (max_digits != null) {
			let digits = s.replace(/[^\d]/g, '').length
			if (digits > max_digits)
				return false // too many digits
		}
		return /^[\-]?\d*\.?\d*$/.test(s) // allow digits and '.' only
	}

	e.input.on('wheel', function(dy) {
		e.set_val(e.input_val + (dy / 100), {input: e})
		e.input.select(0, -1)
		return false
	})

	// increment buttons click

	let increment
	function increment_val() {
		if (!increment) return
		let v = e.input_val + increment
		let r = v % or(e.field.multiple_of, 1)
		e.set_val(v - r, {input: e})
		e.input.select(0, -1)
	}
	let increment_timer
	function start_incrementing() {
		increment_val()
		increment_timer = setInterval(increment_val, 100)
	}
	let start_incrementing_timer
	function add_events(button, sign) {
		button.on('pointerdown', function() {
			if (start_incrementing_timer || increment_timer)
				return
			e.input.focus()
			increment = or(e.field.multiple_of, 1) * sign
			increment_val()
			start_incrementing_timer = after(.5, start_incrementing)
			return false
		})
		function pointerup() {
			clearTimeout(start_incrementing_timer)
			clearInterval(increment_timer)
			start_incrementing_timer = null
			increment_timer = null
			increment = 0
		}
		button.on('pointerup', pointerup)
		button.on('pointerleave', pointerup)
	}
	add_events(e.up  , 1)
	add_events(e.down, -1)

})

// ---------------------------------------------------------------------------
// slider
// ---------------------------------------------------------------------------

component('x-slider', function(e) {

	tabindex_widget(e)

	e.from = 0
	e.to = 1

	e.classes = 'x-widget x-slider'

	e.val_fill = div({class: 'x-slider-fill x-slider-value-fill'})
	e.range_fill = div({class: 'x-slider-fill x-slider-range-fill'})
	e.input_thumb = div({class: 'x-slider-thumb x-slider-input-thumb'})
	e.val_thumb = div({class: 'x-slider-thumb x-slider-value-thumb'})
	e.add(e.range_fill, e.val_fill, e.val_thumb, e.input_thumb)

	// model

	val_widget(e)

	e.field_type = 'number'
	update(e.field_prop_map, {field_type: 'type'})

	e.init = function() {
		e.init_nav()
		e.class('animated', e.field.multiple_of >= 5) // TODO: that's not the point of this.
	}

	e.attach = function() {
		e.init_val()
		e.bind_nav(true)
	}

	e.detach = function() {
		e.bind_nav(false)
	}

	function progress_for(v) {
		return lerp(v, e.from, e.to, 0, 1)
	}

	function cmin() { return max(or(e.field.min, -1/0), e.from) }
	function cmax() { return min(or(e.field.max, 1/0), e.to) }

	e.set_progress = function(p, ev) {
		let v = lerp(p, 0, 1, e.from, e.to)
		if (e.field.multiple_of != null)
			v = floor(v / e.field.multiple_of + .5) * e.field.multiple_of
		e.set_val(clamp(v, cmin(), cmax()), ev)
	}

	e.late_property('progress',
		function() {
			return progress_for(e.input_val)
		},
		e.set_progress,
		0
	)

	// view

	function update_thumb(thumb, p, show) {
		thumb.show(show)
		thumb.style.left = (p * 100)+'%'
	}

	function update_fill(fill, p1, p2) {
		fill.style.left  = (p1 * 100)+'%'
		fill.style.width = ((p2 - p1) * 100)+'%'
	}

	e.update_val = function(v) {
		let input_p = progress_for(v)
		let val_p = progress_for(e.val)
		let diff = input_p != val_p
		update_thumb(e.val_thumb, val_p, diff)
		update_thumb(e.input_thumb, input_p)
		e.val_thumb.class('different', diff)
		e.input_thumb.class('different', diff)
		let p1 = progress_for(cmin())
		let p2 = progress_for(cmax())
		update_fill(e.val_fill, max(p1, 0), min(p2, val_p))
		update_fill(e.range_fill, p1, p2)
	}

	// controller

	let hit_x

	e.input_thumb.on('pointerdown', function(ev) {
		e.focus()
		let r = e.input_thumb.rect()
		hit_x = ev.clientX - (r.x + r.w / 2)
		document.on('pointermove', document_pointermove)
		document.on('pointerup'  , document_pointerup)
		return false
	})

	function document_pointermove(mx, my) {
		let r = e.rect()
		e.set_progress((mx - r.x - hit_x) / r.w, {input: e})
		return false
	}

	function document_pointerup() {
		hit_x = null
		document.off('pointermove', document_pointermove)
		document.off('pointerup'  , document_pointerup)
	}

	e.on('pointerdown', function(ev) {
		let r = e.rect()
		e.set_progress((ev.clientX - r.x) / r.w, {input: e})
	})

	e.on('keydown', function(key, shift) {
		let d
		switch (key) {
			case 'ArrowLeft'  : d =  -.1; break
			case 'ArrowRight' : d =   .1; break
			case 'ArrowUp'    : d =  -.1; break
			case 'ArrowDown'  : d =   .1; break
			case 'PageUp'     : d =  -.5; break
			case 'PageDown'   : d =   .5; break
			case 'Home'       : d = -1/0; break
			case 'End'        : d =  1/0; break
		}
		if (d) {
			e.set_progress(e.progress + d * (shift ? .1 : 1), {input: e})
			return false
		}
	})

	e.inspect_fields = [

		{name: 'from', type: 'number'},
		{name: 'to', type: 'number'},
		{name: 'multiple_of', type: 'number'},

		{name: 'grid_area'},
		{name: 'tabIndex', type: 'number'},

	]

})

// ---------------------------------------------------------------------------
// dropdown
// ---------------------------------------------------------------------------

component('x-dropdown', function(e) {

	// view

	tabindex_widget(e)

	e.classes = 'x-widget x-input x-dropdown'

	e.val_div = span({class: 'x-input-value x-dropdown-value'})
	e.button = span({class: 'x-dropdown-button fa fa-caret-down'})
	e.inner_label_div = div({class: 'x-input-inner-label x-dropdown-inner-label'})
	e.add(e.val_div, e.button, e.inner_label_div)

	val_widget(e)
	input_widget(e)

	let init_nav = e.init_nav
	e.init_nav = function() {
		init_nav()
		if (e.nav !== true)
			e.picker.rebind_val(e.nav, e.col)
	}

	e.init = function() {
		e.init_nav()
		e.picker.on('val_picked', picker_val_picked)
		e.picker.on('keydown', picker_keydown)
	}

	function bind_document(on) {
		document.on('pointerdown', document_pointerdown, on)
		document.on('rightpointerdown', document_pointerdown, on)
		document.on('stopped_event', document_stopped_event, on)
	}

	e.attach = function() {
		e.init_val()
		e.bind_nav(true)
		bind_document(true)
	}

	e.detach = function() {
		e.close()
		bind_document(false)
		e.bind_nav(false)
	}

	// val updating

	e.update_val = function(v, ev) {
		let text = e.display_val()
		let empty = text === ''
		e.val_div.class('empty', empty)
		e.val_div.class('null', v == null)
		e.inner_label_div.class('empty', empty)
		e.val_div.set(empty ? H('&nbsp;') : text)
		if (ev && ev.focus)
			e.focus()
	}

	let error_tooltip_check = e.error_tooltip_check
	e.error_tooltip_check = function() {
		return error_tooltip_check() || (e.invalid && e.isopen)
	}

	// focusing

	let builtin_focus = e.focus
	let focusing_picker
	e.focus = function() {
		if (e.isopen) {
			focusing_picker = true // focusout barrier.
			e.picker.focus()
			focusing_picker = false
		} else
			builtin_focus.call(this)
	}

	// opening & closing the picker

	e.set_open = function(open, focus) {
		if (e.isopen != open) {
			e.class('open', open)
			e.button.switch_class('fa-caret-down', 'fa-caret-up', open)
			e.picker.class('picker', open)
			if (open) {
				e.cancel_val = e.input_val
				e.picker.min_w = e.rect().w
				e.picker.popup(e, 'bottom', e.align)
				e.fire('opened')
			} else {
				e.cancel_val = null
				e.picker.popup(false)
				e.fire('closed')
				if (!focus)
					e.fire('lost_focus') // grid editor protocol
			}
		}
		if (focus)
			e.focus()
	}

	e.open   = function(focus) { e.set_open(true, focus) }
	e.close  = function(focus) { e.set_open(false, focus) }
	e.toggle = function(focus) { e.set_open(!e.isopen, focus) }
	e.cancel = function(focus) {
		if (e.isopen) {
			e.set_val(e.cancel_val)
			e.close(focus)
		}
		else
			e.close(focus)
	}

	e.late_property('isopen',
		function() {
			return e.hasclass('open')
		},
		function(open) {
			e.set_open(open, true)
		}
	)

	// picker protocol

	function picker_val_picked() {
		e.close(true)
	}

	// keyboard & mouse binding

	e.on('click', function() {
		e.toggle(true)
		return false
	})

	e.on('keydown', function(key) {
		if (key == 'Enter' || key == ' ') {
			e.toggle(true)
			return false
		}
		if (key == 'ArrowDown' || key == 'ArrowUp') {
			if (!e.hasclass('grid-editor')) {
				e.picker.pick_near_val(key == 'ArrowDown' ? 1 : -1, {input: e})
				return false
			}
		}
	})

	e.on('keypress', function(c) {
		if (e.picker.quicksearch) {
			e.picker.quicksearch(c)
			return false
		}
	})

	function picker_keydown(key) {
		if (key == 'Escape' || key == 'Tab') {
			e.cancel(true)
			return false
		}
	}

	e.on('wheel', function(dy) {
		e.picker.pick_near_val(dy / 100, {input: e})
		return false
	})

	// clicking outside the picker closes the picker.
	function document_pointerdown(ev) {
		if (e.contains(ev.target)) // clicked inside the dropdown.
			return
		if (e.picker.contains(ev.target)) // clicked inside the picker.
			return
		e.cancel()
	}

	// clicking outside the picker closes the picker, even if the click did something.
	function document_stopped_event(ev) {
		if (ev.type.ends('pointerdown'))
			document_pointerdown(ev)
	}

	e.on('focusout', function(ev) {
		// prevent dropdown's focusout from bubbling to the parent when opening the picker.
		if (focusing_picker)
			return false
		e.fire('lost_focus') // grid editor protocol
	})

})

// ---------------------------------------------------------------------------
// menu
// ---------------------------------------------------------------------------

component('x-menu', function(e) {

	// view

	function create_item(item) {
		let check_div = div({class: 'x-menu-check-div fa fa-check'})
		let icon_div  = div({class: 'x-menu-icon-div'})
		if (typeof item.icon == 'string')
			icon_div.classes = item.icon
		else
			icon_div.set(item.icon)
		let check_td  = H.td ({class: 'x-menu-check-td'}, check_div, icon_div)
		let title_td  = H.td ({class: 'x-menu-title-td'})
		title_td.set(item.text)
		let key_td    = H.td ({class: 'x-menu-key-td'}, item.key)
		let sub_div   = div({class: 'x-menu-sub-div fa fa-caret-right'})
		let sub_td    = H.td ({class: 'x-menu-sub-td'}, sub_div)
		sub_div.style.visibility = item.items ? null : 'hidden'
		let tr = H.tr({class: 'x-item x-menu-tr'}, check_td, title_td, key_td, sub_td)
		tr.class('disabled', item.enabled == false)
		tr.item = item
		tr.check_div = check_div
		update_check(tr)
		tr.on('pointerup'   , item_pointerup)
		tr.on('pointerenter', item_pointerenter)
		return tr
	}

	function create_heading(item) {
		let td = H.td({class: 'x-menu-heading', colspan: 5})
		td.set(item.heading)
		let tr = H.tr({}, td)
		tr.focusable = false
		tr.on('pointerenter', separator_pointerenter)
		return tr
	}

	function create_separator() {
		let td = H.td({class: 'x-menu-separator', colspan: 5}, H.hr())
		let tr = H.tr({}, td)
		tr.focusable = false
		tr.on('pointerenter', separator_pointerenter)
		return tr
	}

	function create_menu(items) {
		let table = H.table({class: 'x-widget x-focusable x-menu-table', tabindex: 0})
		for (let i = 0; i < items.length; i++) {
			let item = items[i]
			let tr = item.heading ? create_heading(item) : create_item(item)
			table.add(tr)
			if (item.separator)
				table.add(create_separator())
		}
		table.on('keydown', menu_keydown)
		return table
	}

	e.init = function() {
		e.table = create_menu(e.items)
		e.add(e.table)
	}

	function show_submenu(tr) {
		if (tr.submenu_table)
			return tr.submenu_table
		let items = tr.item.items
		if (!items)
			return
		let table = create_menu(items)
		table.x = tr.clientWidth - 2
		table.parent_menu = tr.parent
		tr.submenu_table = table
		tr.add(table)
		return table
	}

	function hide_submenu(tr) {
		if (!tr.submenu_table)
			return
		tr.submenu_table.remove()
		tr.submenu_table = null
	}

	function select_item(menu, tr) {
		unselect_selected_item(menu)
		menu.selected_item_tr = tr
		if (tr)
			tr.class('focused', true)
	}

	function unselect_selected_item(menu) {
		let tr = menu.selected_item_tr
		if (!tr)
			return
		menu.selected_item_tr = null
		hide_submenu(tr)
		tr.class('focused', false)
	}

	function update_check(tr) {
		tr.check_div.show(tr.item.checked != null)
		tr.check_div.style.visibility = tr.item.checked ? null : 'hidden'
	}

	// popup protocol

	function bind_document(on) {
		document.on('pointerdown', document_pointerdown, on)
		document.on('rightpointerdown', document_pointerdown, on)
		document.on('stopped_event', document_stopped_event, on)
	}

	e.popup_target_attached = function(target) {
		bind_document(true)
	}

	e.popup_target_detached = function(target) {
		bind_document(false)
	}

	function document_pointerdown(ev) {
		if (e.contains(ev.target)) // clicked inside the menu.
			return
		e.close()
	}

	// clicking outside the menu closes the menu, even if the click did something.
	function document_stopped_event(ev) {
		if (e.contains(ev.target)) // clicked inside the menu.
			return
		if (ev.type.ends('pointerdown'))
			e.close()
	}

	let popup_target

	e.close = function(focus_target) {
		let target = popup_target
		e.popup(false)
		select_item(e.table, null)
		if (target && focus_target)
			target.focus()
	}

	e.override('popup', function(inherited, target, side, align, x, y, select_first_item) {
		popup_target = target
		inherited.call(this, target, side, align, x, y)
		if (select_first_item)
			select_next_item(e.table)
		e.table.focus()
	})

	// navigation

	function next_item(menu, down, tr) {
		tr = tr && (down ? tr.next : tr.prev)
		return tr || (down ? menu.first : menu.last)
	}
	function next_valid_item(menu, down, tr, enabled) {
		let i = menu.children.length
		while (i--) {
			tr = next_item(menu, down != false, tr)
			if (tr && tr.focusable != false && (!enabled || tr.enabled != false))
				return tr
		}
	}
	function select_next_item(menu, down, tr0, enabled) {
		select_item(menu, next_valid_item(menu, down, tr0, enabled))
	}

	function activate_submenu(tr) {
		let submenu = show_submenu(tr)
		if (!submenu)
			return
		submenu.focus()
		select_next_item(submenu)
		return true
	}

	function click_item(tr, allow_close, from_keyboard) {
		let item = tr.item
		if ((item.action || item.checked != null) && item.enabled != false) {
			if (item.checked != null) {
				item.checked = !item.checked
				update_check(tr)
			}
			if (!item.action || item.action(item) != false)
				if (allow_close != false)
					e.close(from_keyboard)
		}
	}

	// mouse bindings

	function item_pointerup() {
		click_item(this)
		return false
	}

	function item_pointerenter(ev) {
		if (this.submenu_table)
			return // mouse entered on the submenu.
		this.parent.focus()
		select_item(this.parent, this)
		show_submenu(this)
	}

	function separator_pointerenter(ev) {
		select_item(this.parent)
	}

	// keyboard binding

	function menu_keydown(key) {
		if (key == 'ArrowUp' || key == 'ArrowDown') {
			select_next_item(this, key == 'ArrowDown', this.selected_item_tr)
			return false
		}
		if (key == 'ArrowRight') {
			if (this.selected_item_tr)
				activate_submenu(this.selected_item_tr)
			return false
		}
		if (key == 'ArrowLeft') {
			if (this.parent_menu) {
				this.parent_menu.focus()
				hide_submenu(this.parent)
			}
			return false
		}
		if (key == 'Home' || key == 'End') {
			select_next_item(this, key == 'Home')
			return false
		}
		if (key == 'PageUp' || key == 'PageDown') {
			select_next_item(this, key == 'PageUp')
			return false
		}
		if (key == 'Enter' || key == ' ') {
			let tr = this.selected_item_tr
			if (tr) {
				let submenu_activated = activate_submenu(tr)
				click_item(tr, !submenu_activated, true)
			}
			return false
		}
		if (key == 'Escape') {
			if (this.parent_menu) {
				this.parent_menu.focus()
				hide_submenu(this.parent)
			} else
				e.close(true)
			return false
		}
	}

})

// ---------------------------------------------------------------------------
// widget placeholder
// ---------------------------------------------------------------------------

component('x-widget-placeholder', function(e) {

	cssgrid_child_widget(e)
	serializable_widget(e)
	e.align_x = 'stretch'
	e.align_y = 'stretch'

	e.classes = 'x-widget x-widget-placeholder'

	let stretched_widgets = [
		['SP', 'split'],
		['CG', 'cssgrid'],
		['PL', 'pagelist', true],
		['L', 'listbox'],
		['G', 'grid', true],
	]

	let form_widgets = [
		['I' , 'input'],
		['SI', 'spin_input'],
		['CB', 'checkbox'],
		['RG', 'radiogroup'],
		['SL', 'slider'],
		['LD', 'list_dropdown'],
		['GD', 'grid_dropdown'],
		['DD', 'date_dropdown', true],
		['B', 'button'],
	]

	function replace_with_widget() {
		let widget = component.create({typename: this.typename})
		let pe = e.parent_widget
		if (pe)
			pe.replace_widget(e, widget)
		else {
			let pe = e.parent
			pe.replace(e, widget)
			root_widget = widget
			pe.fire('widget_tree_changed')
		}
		widget.focus()
	}

	function create_widget_buttons(widgets) {
		e.clear()
		let i = 1
		for (let [s, typename, sep] of widgets) {
			let btn = button({text: s, title: typename, pos_x: i++})
			btn.class('x-widget-placeholder-button')
			if (sep)
				btn.style['margin-right'] = '.5em'
			e.add(btn)
			btn.typename = typename
			btn.action = replace_with_widget
		}
	}

	e.attach = function() {
		widgets = stretched_widgets
		let pe = e.parent_widget
		if (pe && pe.accepts_form_widgets)
			widgets = [].concat(widgets, form_widgets)
		create_widget_buttons(widgets)
	}

})

// ---------------------------------------------------------------------------
// pagelist
// ---------------------------------------------------------------------------

component('x-pagelist', function(e) {

	cssgrid_child_widget(e)
	e.align_x = 'stretch'
	e.align_y = 'stretch'
	serializable_widget(e)
	e.classes = 'x-widget x-pagelist'

	e.prop('tabs', {attr: 'tabs', type: 'enum', enum_values: ['above', 'below'], default: 'above'})

	e.header = div({class: 'x-pagelist-header'})
	e.content = div({class: 'x-pagelist-content'})
	e.add_button = div({class: 'x-pagelist-item x-pagelist-add-button fa fa-plus', tabindex: 0})
	e.add(e.header, e.content)

	function add_item(item) {
		if (typeof item == 'string' || item instanceof Node)
			item = {text: item}
		item.page = component.create(item.page || {typename: 'widget_placeholder'})
		let xbutton = div({class: 'x-pagelist-xbutton fa fa-times'})
		xbutton.hide()
		let tdiv = div({class: 'x-pagelist-text'})
		let idiv = div({class: 'x-pagelist-item', tabindex: 0}, tdiv, xbutton)
		idiv.text_div = tdiv
		idiv.xbutton = xbutton
		tdiv.set(item.text)
		tdiv.title = item.text
		idiv.on('pointerdown', idiv_pointerdown)
		idiv.on('dblclick'   , idiv_dblclick)
		idiv.on('keydown'    , idiv_keydown)
		tdiv.on('input'      , tdiv_input)
		xbutton.on('pointerdown', xbutton_pointerdown)
		idiv.item = item
		item.idiv = idiv
		e.header.add(idiv)
		e.items.push(item)
	}

	e.init = function() {
		let items = e.items
		e.items = []
		if (items)
			for (let item of items)
				add_item(item)
		e.header.add(e.add_button)
		e.selection_bar = div({class: 'x-pagelist-selection-bar'})
		e.header.add(e.selection_bar)
		e.update()
	}

	function update_item(idiv, select) {
		idiv.xbutton.show(select && (e.can_remove_items || e.editing))
		idiv.text_div.contenteditable = select && (e.editing || e.renaming)
	}

	function update_selection_bar() {
		let idiv = e.selected_item
		e.selection_bar.x = idiv ? idiv.ox : 0
		e.selection_bar.w = idiv ? idiv.rect().w   : 0
		e.selection_bar.show(!!idiv)
	}

	e.update = function() {
		update_selection_bar()
		let idiv = e.selected_item
		if (idiv)
			update_item(idiv, true)
		e.add_button.show(e.can_add_items || e.editing)
	}

	e.set_can_add_items    = update
	e.set_can_remove_items = update
	e.set_can_rename_items = update

	e.prop('can_rename_items', {store: 'var', type: 'bool', default: false})
	e.prop('can_add_items'   , {store: 'var', type: 'bool', default: false})
	e.prop('can_remove_items', {store: 'var', type: 'bool', default: false})
	e.prop('can_move_items'  , {store: 'var', type: 'bool', default: true})

	e.attach = function() {
		e.selected_index = or(e.selected_index, 0)
	}

	function select_item(idiv, focus_page) {
		if (e.selected_item != idiv) {
			if (e.selected_item) {
				e.selected_item.class('selected', false)
				e.fire('close', e.selected_item.index)
				e.content.clear()
				update_item(e.selected_item, false)
			}
			e.selected_item = idiv
			e.update()
			if (idiv) {
				idiv.class('selected', true)
				e.fire('open', idiv.index)
				let page = idiv.item.page
				e.content.set(page)
			}
		}
		if (!e.editing && focus_page != false) {
			let first_focusable = e.content.focusables()[0]
			if (first_focusable)
				first_focusable.focus()
		}
	}

	e.late_property('selected_index',
		function() {
			return e.selected_item ? e.selected_item.index : null
		},
		function(i) {
			let idiv = i != null ? e.header.at[clamp(i, 0, e.items.length-1)] : null
			select_item(idiv)
		}
	)

	// drag-move tabs ---------------------------------------------------------

	live_move_mixin(e)

	e.set_movable_element_pos = function(i, x) {
		let idiv = e.items[i].idiv
		idiv.x = x - idiv._offset_x
	}

	e.movable_element_size = function(i) {
		return e.items[i].idiv.rect().w
	}

	let dragging, drag_mx

	function idiv_pointerdown(ev, mx, my) {
		if (this.text_div.contenteditable)
			return
		this.focus()
		select_item(this, false)
		return this.capture_pointer(ev, idiv_pointermove, idiv_pointerup)
	}

	function idiv_pointermove(mx, my, ev, down_mx, down_my) {
		if (!dragging) {
			dragging = e.can_move_items
				&& abs(down_mx - mx) > 4 || abs(down_my - my) > 4
			if (dragging) {
				for (let item of e.items)
					item.idiv._offset_x = item.idiv.ox
				e.move_element_start(this.index, 1, 0, e.items.length)
				drag_mx = down_mx - this.ox
				e.class('x-moving', true)
				this.class('x-moving', true)
				update_selection_bar()
			}
		} else {
			e.move_element_update(mx - drag_mx)
			e.update()
		}
	}

	function idiv_pointerup() {
		if (dragging) {
			let over_i = e.move_element_stop()
			let insert_i = over_i - (over_i > this.index ? 1 : 0)
			e.items.remove(this.index)
			e.items.insert(insert_i, this.item)
			this.remove()
			e.header.insert(insert_i, this)
			for (let item of e.items)
				item.idiv.x = null
			update_selection_bar()
			e.class('x-moving', false)
			this.class('x-moving', false)
			dragging = false
		}
		select_item(this)
	}

	// key bindings -----------------------------------------------------------

	function set_renaming(renaming) {
		e.renaming = !!renaming
		e.selected_item.text_div.contenteditable = e.renaming
	}

	function idiv_keydown(key) {
		if (key == 'F2' && e.can_rename_items) {
			set_renaming(!e.renaming)
			return false
		}
		if (e.renaming) {
			if (key == 'Enter' || key == 'Escape') {
				set_renaming(false)
				return false
			}
		}
		if (!e.editing && !e.renaming) {
			if (key == ' ' || key == 'Enter') {
				select_item(this)
				return false
			}
			if (key == 'ArrowRight' || key == 'ArrowLeft') {
				e.selected_index += (key == 'ArrowRight' ? 1 : -1)
				if (e.selected_item)
					e.selected_item.focus()
				return false
			}
		}
	}

	let editing = false
	e.property('editing',
		function() { return editing },
		function(v) {
			editing = !!v
			e.update()
		}
	)

	e.add_button.on('click', function() {
		if (e.selected_item == this)
			return
		let item = {text: 'New'}
		e.selection_bar.remove()
		e.add_button.remove()
		add_item(item)
		e.header.add(e.selection_bar)
		e.header.add(e.add_button)
		e.fire('widget_tree_changed')
		return false
	})

	function idiv_dblclick() {
		if (e.renaming || !e.can_rename_items)
			return
		set_renaming(true)
		this.focus()
		return false
	}

	function tdiv_input() {
		e.items[e.selected_index].text = e.selected_item.text_div.textContent
		e.update()
	}

	function xbutton_pointerdown() {
		let idiv = this.parent
		select_item(null)
		idiv.remove()
		e.items.remove_value(idiv.item)
		e.fire('widget_tree_changed')
		return false
	}

	// xmodule protocol -------------------------------------------------------

	e.child_widgets = function() {
		let widgets = []
		for (let item of e.items)
			widgets.push(item.page)
		return widgets
	}

	e.replace_widget = function(old_widget, new_widget) {
		for (let item of e.items)
			if (item.page == old_widget) {
				old_widget.parent.replace(old_widget, new_widget)
				item.page = new_widget
				e.fire('widget_tree_changed')
				break
			}
	}

	e.select_child_widget = function(widget) {
		for (let item of e.items)
			if (item.page == widget)
				select_item(item.idiv)
	}

	e.inspect_fields = [

		{name: 'can_remove_items', type: 'bool'},

		{name: 'grid_area'},
		{name: 'tabIndex', type: 'number'},

	]

	e.serialize = function() {
		let t = e.serialize_fields()
		t.items = []
		for (let item of e.items) {
			let sitem = {text: item.text}
			sitem.page = item.page.serialize()
			t.items.push(sitem)
		}
		return t
	}

})

// ---------------------------------------------------------------------------
// split-view
// ---------------------------------------------------------------------------

component('x-split', function(e) {

	cssgrid_child_widget(e)
	e.align_x = 'stretch'
	e.align_y = 'stretch'
	serializable_widget(e)
	e.classes = 'x-widget x-split'

	e.pane1 = div({class: 'x-split-pane'})
	e.pane2 = div({class: 'x-split-pane'})
	e.sizer = div({class: 'x-split-sizer'})
	e.add(e.pane1, e.sizer, e.pane2)

	let horiz, left

	function update_view() {
		horiz = e.orientation == 'horizontal'
		left = e.fixed_side == 'first'
		e.fixed_pane = left ? e.pane1 : e.pane2
		e.auto_pane  = left ? e.pane2 : e.pane1
		e.fixed_pane.class('x-split-pane-fixed')
		e.fixed_pane.class('x-split-pane-auto', false)
		e.auto_pane.class('x-split-pane-auto')
		e.auto_pane.class('x-split-pane-fixed', false)
		e.class('resizeable', e.resizeable)
		e.sizer.show(e.resizeable)
		e.fixed_pane[horiz ? 'h' : 'w'] = null
		e.fixed_pane[horiz ? 'w' : 'h'] = e.fixed_size
		e.auto_pane.w = null
		e.auto_pane.h = null
		e.fixed_pane[horiz ? 'min_h' : 'min_w'] = null
		e.fixed_pane[horiz ? 'min_w' : 'min_h'] = e.min_size
		e.auto_pane.min_w = null
		e.auto_pane.min_h = null
	}

	function update_size() {
		update_view()
		e.fire('layout_changed')
	}

	e.set_orientation = update_view
	e.set_fixed_side = update_view
	e.set_resizeable = update_view
	e.set_fixed_size = update_size
	e.set_min_size = update_size

	e.prop('orientation', {attr: 'orientation', type: 'enum', enum_values: ['horizontal', 'vertical'], default: 'horizontal', noinit: true})
	e.prop('fixed_side' , {attr: 'fixed-side' , type: 'enum', enum_values: ['first', 'second'], default: 'first', noinit: true})
	e.prop('resizeable' , {attr: 'resizeable' , type: 'bool', default: true, noinit: true})
	e.prop('fixed_size' , {store: 'var', type: 'number', default: 200, noinit: true})
	e.prop('min_size'   , {store: 'var', type: 'number', default:   0, noinit: true})

	e.init = function() {
		e[1] = component.create(or(e[1], widget_placeholder()))
		e[2] = component.create(or(e[2], widget_placeholder()))
		e.pane1.set(e[1])
		e.pane2.set(e[2])
		update_view()
	}

	// resizing ---------------------------------------------------------------

	let hit, hit_x, mx0, w0, resizing, resist

	e.on('pointermove', function(rmx, rmy) {
		if (resizing) {

			let mx = horiz ? rmx : rmy
			let w
			if (left) {
				let fpx1 = e.fixed_pane.rect()[horiz ? 'x' : 'y']
				w = mx - (fpx1 + hit_x)
			} else {
				let ex2 = e.rect()[horiz ? 'x2' : 'y2']
				let sw = e.sizer.rect()[horiz ? 'w' : 'h']
				w = ex2 - mx + hit_x - sw
			}

			resist = resist && abs(mx - mx0) < 20
			if (resist)
				w = w0 + (w - w0) * .2 // show resistance

			if (!e.fixed_pane.hasclass('collapsed')) {
				if (w < min(max(e.min_size, 20), 30) - 5)
					e.fixed_pane.class('collapsed', true)
			} else {
				if (w > max(e.min_size, 30))
					e.fixed_pane.class('collapsed', false)
			}

			w = max(w, e.min_size)
			if (e.fixed_pane.hasclass('collapsed'))
				w = 0

			e.fixed_size = round(w)
			e.tooltip.text = round(w)

			return false

		} else {

			// hit-test for split resizing.
			hit = false
			if (e.rect().contains(rmx, rmy)) {
				// ^^ mouse is not over some scrollbar.
				let mx = horiz ? rmx : rmy
				let sr = e.sizer.rect()
				let sx1 = horiz ? sr.x1 : sr.y1
				let sx2 = horiz ? sr.x2 : sr.y2
				w0 = e.fixed_pane.rect()[horiz ? 'w' : 'h']
				hit_x = mx - sx1
				hit = abs(hit_x - (sx2 - sx1) / 2) <= 5
				resist = true
				mx0 = mx
			}
			e.class('resize', hit)

			if (hit)
				return false

		}
	})

	e.on('pointerdown', function(ev) {
		if (!hit)
			return

		e.tooltip = e.tooltip || tooltip()
		e.tooltip.side = horiz ? (left ? 'right' : 'left') : (left ? 'bottom' : 'top')
		e.tooltip.target = e.sizer
		e.tooltip.text = e.fixed_size

		resizing = true
		e.class('resizing')

		return 'capture'
	})

	e.on('pointerup', function() {
		if (!resizing)
			return

		e.class('resizing', false)
		resizing = false

		if (resist) // reset width
			e.fixed_size = w0

		if (e.tooltip)
			e.tooltip.target = false

		return false
	})

	// xmodule protocol -------------------------------------------------------

	e.child_widgets = function() {
		return [e[1], e[2]]
	}

	function widget_index(ce) {
		return e[1] == ce && 1 || e[2] == ce && 2 || null
	}

	e.replace_widget = function(old_widget, new_widget) {
		e[widget_index(old_widget)] = new_widget
		old_widget.parent.replace(old_widget, new_widget)
		update_view()
		e.fire('widget_tree_changed')
	}

	e.select_child_widget = function(widget) {
		// TODO
	}

	e.serialize = function() {
		let t = e.serialize_fields()
		t[1] = e[1].serialize()
		t[2] = e[2].serialize()
		return t
	}

})

function hsplit(...options) { return split(...options) }
function vsplit(...options) { return split(update({orientation: 'vertical'}, ...options)) }

// ---------------------------------------------------------------------------
// toaster
// ---------------------------------------------------------------------------

component('x-toaster', function(e) {

	e.classes = 'x-widget x-toaster'

	e.tooltips = new Set()

	e.target = document.body
	e.side = 'inner-top'
	e.align = 'center'
	e.timeout = 'auto'
	e.spacing = 6

	function update_stack() {
		let py = 0
		for (let t of e.tooltips) {
			t.py = py
			py += t.rect().h + e.spacing
		}
	}

	function popup_removed() {
		e.tooltips.delete(this)
		update_stack()
	}

	function popup_check() {
		this.style.position = 'fixed'
		return true
	}

	e.post = function(text, kind, timeout) {
		let t = tooltip({
			classes: 'x-toaster-message',
			kind: kind,
			target: e.target,
			text: text,
			side: e.side,
			align: e.align,
			timeout: opt(timeout, e.timeout),
			check: popup_check,
			popup_target_detached: popup_removed,
		})
		e.tooltips.add(t)
		update_stack()
	}

	e.close_all = function() {
		for (t of e.tooltips)
			t.target = false
	}

	e.detach = function() {
		e.close_all()
	}

})

// global notify function.
{
	let t
	function notify(...args) {
		t = t || toaster({classes: 'x-notify-toaster'})
		t.post(...args)
	}
}

// ---------------------------------------------------------------------------
// action band
// ---------------------------------------------------------------------------

component('x-action-band', function(e) {

	e.classes = 'x-widget x-action-band'
	e.layout = 'ok:ok cancel:cancel'

	e.init = function() {
		let ct = e
		for (let s of e.layout.split(' ')) {
			if (s == '<') {
				ct = div({style: `
						flex: auto;
						display: flex;
						flex-flow: row wrap;
						justify-content: center;
					`})
				e.add(ct)
				continue
			} else if (s == '>') {
				align = 'right'
				ct = e
				continue
			}
			s = s.split(':')
			let name = s.shift()
			let spec = new Set(s)
			let btn = e.buttons && e.buttons[name.replace('-', '_').replace(/[^\w]/g, '')]
			let btn_sets_text
			if (!(btn instanceof Node)) {
				if (typeof btn == 'function')
					btn = {action: btn}
				else
					btn = update({}, btn)
				if (spec.has('primary') || spec.has('ok'))
					btn.primary = true
				btn_sets_text = btn.text != null
				btn = button(btn)
			}
			btn.class('x-dialog-button-'+name)
			btn.dialog = e
			if (!btn_sets_text) {
				btn.text = S(name.replace('-', '_'), name.replace(/[_\-]/g, ' '))
				btn.style['text-transform'] = 'capitalize'
			}
			if (name == 'ok' || spec.has('ok')) {
				btn.on('action', function() {
					e.ok()
				})
			}
			if (name == 'cancel' || spec.has('cancel')) {
				btn.on('action', function() {
					e.cancel()
				})
			}
			ct.add(btn)
		}
	}

	e.ok = function() {
		e.fire('ok')
	}

	e.cancel = function() {
		e.fire('cancel')
	}

})

// ---------------------------------------------------------------------------
// modal dialog with action band footer
// ---------------------------------------------------------------------------

component('x-dialog', function(e) {

	tabindex_widget(e)

	e.classes = 'x-widget x-dialog'

	e.x_button = true
	e.footer = 'ok:ok cancel:cancel'

	e.init = function() {
		if (e.title != null) {
			let title = div({class: 'x-dialog-title'})
			title.set(e.title)
			e.title = title
			e.header = div({class: 'x-dialog-header'}, title)
		}
		if (!e.content)
			e.content = div()
		e.content.class('x-dialog-content')
		if (!(e.footer instanceof Node))
			e.footer = action_band({layout: e.footer, buttons: e.buttons})
		e.add(e.header, e.content, e.footer)
		if (e.x_button) {
			e.x_button = div({class: 'x-dialog-button-close fa fa-times'})
			e.x_button.on('click', function() {
				e.cancel()
			})
			e.add(e.x_button)
		}
	}

	e.on('keydown', function(key) {
		if (key == 'Escape')
			if (e.x_button)
				e.x_button.class('active', true)
	})

	e.on('keyup', function(key) {
		if (key == 'Escape')
			e.cancel()
		else if (key == 'Enter')
			e.ok()
	})

	e.close = function() {
		e.modal(false)
		if (e.x_button)
			e.x_button.class('active', false)
	}

	e.cancel = function() {
		if (e.fire('cancel'))
			e.close()
	}

	e.ok = function() {
		if (e.fire('ok'))
			e.close()
	}

})

// ---------------------------------------------------------------------------
// floating toolbox
// ---------------------------------------------------------------------------

component('x-toolbox', function(e) {

	tabindex_widget(e)

	e.classes = 'x-widget x-toolbox'

	let xbutton = div({class: 'x-toolbox-xbutton fa fa-times'})
	let title_div = div({class: 'x-toolbox-title'})
	e.titlebar = div({class: 'x-toolbox-titlebar'}, title_div, xbutton)
	e.add(e.titlebar)

	e.init = function() {
		title_div.set(e.title)
		e.title = ''

		let content = div({class: 'x-toolbox-content'})
		content.set(e.content)
		e.add(content)
		e.content = content

		e.hide()
		document.body.add(e)
	}

	{
		let moving, drag_x, drag_y

		e.titlebar.on('pointerdown', function(_, mx, my) {
			e.focus()
			moving = true
			let r = e.rect()
			drag_x = mx - r.x
			drag_y = my - r.y
			return 'capture'
		})

		e.titlebar.on('pointerup', function() {
			moving = false
			return false
		})

		e.titlebar.on('pointermove', function(mx, my) {
			if (!moving) return
			let r = this.rect()
			e.x = clamp(0, mx - drag_x, window.innerWidth  - r.w)
			e.y = clamp(0, my - drag_y, window.innerHeight - r.h)
			return false
		})
	}

	xbutton.on('pointerdown', function() {
		e.hide()
		return false
	})

	e.on('attr_changed', function() {
		e.fire('layout_changed')
	})

})

